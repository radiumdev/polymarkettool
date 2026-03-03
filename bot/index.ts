/**
 * PolyCopy Bot v4.0 — Prisma + Real Trade Detection + CLOB Execution
 * Uses Data API /activity for monitoring + @polymarket/clob-client for execution
 * Database: Prisma (SQLite) — shared with Next.js dashboard
 */
import fs from "fs";
import path from "path";
import { initTelegram, isEnabled as tgEnabled, sendTradeAlert, sendFilterNotice, sendExecConfirmation, sendStatus, pollCallbacks } from "./telegram";
import * as db from "./db";

// ── Load .env.local ──────────────────────────────────────
for (const envFile of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(p)) {
    fs.readFileSync(p, "utf-8").split("\n").forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (val && !process.env[key]) process.env[key] = val;
    });
    console.log(`Loaded env from ${envFile}`);
    break;
  }
}

const DATA_API = "https://data-api.polymarket.com";
const CLOB_URL = process.env.POLY_CLOB_URL || "https://clob.polymarket.com";
const POLL = Number(process.env.POLL_INTERVAL || 5000);
const KEY = process.env.PRIVATE_KEY || "";
let USER_ID = process.env.USER_ID || "";

// ── Logger ───────────────────────────────────────────────
function log(level: string, msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}`);
  if (USER_ID) db.addLog(USER_ID, level, msg).catch(() => {});
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

// ── CLOB Client Setup ────────────────────────────────────
let clobClient: any = null;

async function initClobClient() {
  if (!KEY) {
    log("warn", "No PRIVATE_KEY — running in DRY RUN mode (no real trades)");
    return false;
  }
  try {
    const { ClobClient } = await import("@polymarket/clob-client");
    const { ethers } = await import("ethers");
    const chainId = 137; // Polygon
    const wallet = new ethers.Wallet(KEY);
    log("info", `Wallet: ${wallet.address}`);
    clobClient = new ClobClient(CLOB_URL, chainId, wallet);
    log("info", "Deriving API key from wallet...");
    try {
      const creds = await clobClient.createOrDeriveApiKey();
      if (creds && creds.key) {
        clobClient = new ClobClient(CLOB_URL, chainId, wallet, creds);
        log("info", `API key derived: ${creds.key.slice(0, 8)}...`);
      }
    } catch (e: any) {
      log("warn", `API key derivation: ${e.message?.slice(0, 80)} — will try without`);
    }
    return true;
  } catch (e: any) {
    log("error", `CLOB init failed: ${e.message?.slice(0, 100)}`);
    return false;
  }
}

// ── Smart Filters ────────────────────────────────────────
function applySmartFilters(trade: any, config: any): { pass: boolean; reason: string } {
  // 1. Min trade size
  if (trade.usdcSize < (config.minTradeSize || 50))
    return { pass: false, reason: `Size $${trade.usdcSize.toFixed(0)} < min $${config.minTradeSize || 50}` };

  // 2. Category filter
  const excluded = (config.excludeCategories || "").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
  if (excluded.length && trade.market) {
    const marketLower = trade.market.toLowerCase();
    if (excluded.some((cat: string) => marketLower.includes(cat)))
      return { pass: false, reason: `Category excluded: ${trade.market.slice(0, 40)}` };
  }

  // 3. Price range (skip near-resolved)
  const skipLow = config.skipLowPrice ?? 0.03;
  const skipHigh = config.skipHighPrice ?? 0.97;
  if (trade.price < skipLow || trade.price > skipHigh)
    return { pass: false, reason: `Price ${trade.price.toFixed(3)} outside [${skipLow}, ${skipHigh}]` };

  // 4. Side filter
  const onlySide = config.onlySide || "both";
  if (onlySide !== "both" && trade.side?.toUpperCase() !== onlySide.toUpperCase())
    return { pass: false, reason: `Side ${trade.side} filtered (only ${onlySide})` };

  // 5. Stale trade
  const maxAge = (config.maxTradeAge || 120) * 1000;
  const age = Date.now() - (trade.timestamp || Date.now());
  if (age > maxAge)
    return { pass: false, reason: `Trade too old: ${Math.round(age / 1000)}s > ${config.maxTradeAge || 120}s` };

  return { pass: true, reason: "" };
}

// ── Conviction Detection ─────────────────────────────────
const recentTradesMap = new Map<string, { market: string; side: string; ts: number }[]>();

function checkConviction(trade: any, config: any): number {
  const minRepeats = config.convictionMinRepeats || 2;
  const window = (config.convictionWindow || 3600) * 1000;
  const multiplier = config.convictionMultiplier || 1.5;

  const key = `${trade.address}:${trade.conditionId}`;
  const now = Date.now();

  if (!recentTradesMap.has(key)) recentTradesMap.set(key, []);
  const history = recentTradesMap.get(key)!;

  // Clean old entries
  while (history.length > 0 && now - history[0].ts > window) history.shift();

  // Add this trade
  history.push({ market: trade.market, side: trade.side, ts: now });

  // Count same-direction trades in window
  const sameSide = history.filter(h => h.side === trade.side).length;

  if (sameSide >= minRepeats) {
    log("info", `🔥 CONVICTION: ${trade.label} hit ${sameSide}x ${trade.side} on "${trade.market}" → ${multiplier}x`);
    return multiplier;
  }
  return 1.0;
}

// ── Poll wallet for new trades ───────────────────────────
const lastSeen = new Map<string, number>();

async function pollWallet(address: string, label: string, allocation: number) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(`${DATA_API}/activity?user=${address}&type=TRADE&limit=10`, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    const prev = lastSeen.get(address) || Math.floor(Date.now() / 1000);
    const fresh = data.filter((t: any) => (t.timestamp || 0) > prev);

    if (fresh.length > 0) {
      const newest = Math.max(...data.map((t: any) => t.timestamp || 0));
      lastSeen.set(address, newest);
    }

    return fresh.map((t: any) => ({
      tradeId: t.transactionHash || uid(),
      address,
      label,
      allocation,
      side: t.side || "BUY",
      price: Number(t.price || 0),
      size: Number(t.size || 0),
      usdcSize: Number(t.usdcSize || t.size || 0),
      tokenId: t.asset || "",
      market: t.title || "",
      conditionId: t.conditionId || "",
      outcome: t.outcome || "",
      outcomeIndex: t.outcomeIndex || 0,
      slug: t.slug || "",
      timestamp: (t.timestamp || 0) * 1000,
    }));
  } catch (e: any) {
    log("error", `Poll ${label}: ${e.message?.slice(0, 100)}`);
    return [];
  }
}

// ── Execute copy trade via CLOB ──────────────────────────
async function executeCopy(trade: any, config: any): Promise<{ executed: boolean; status: string; skipReason?: string }> {
  const copySize = trade.usdcSize * (config.copyPercentage / 100) * (trade.allocation / 100);

  if (copySize < 1) return { executed: false, status: "skipped", skipReason: "Copy size < $1" };
  if (copySize > config.maxPositionSize) return { executed: false, status: "skipped", skipReason: `Exceeds max $${config.maxPositionSize}` };

  if (!clobClient || !KEY) {
    log("info", `🧪 [DRY RUN] Would ${trade.side} $${copySize.toFixed(2)} on "${trade.market}" (${trade.outcome}) @ ${trade.price}`);
    return { executed: false, status: "dry_run" };
  }

  try {
    log("info", `🚀 EXECUTING: ${trade.side} $${copySize.toFixed(2)} on "${trade.market}" (${trade.outcome}) @ ${trade.price}`);

    const order = {
      tokenID: trade.tokenId,
      price: trade.price,
      size: copySize / trade.price,
      side: trade.side,
    };

    const signedOrder = await clobClient.createOrder(order);
    const result = await clobClient.postOrder(signedOrder);

    if (result?.orderID || result?.success) {
      log("info", `✅ Order placed: ${result.orderID || "OK"}`);
      return { executed: true, status: "executed" };
    } else {
      log("warn", `⚠️ Order response: ${JSON.stringify(result).slice(0, 200)}`);
      return { executed: false, status: "failed", skipReason: "Unexpected response" };
    }
  } catch (e: any) {
    log("error", `❌ Execution failed: ${e.message?.slice(0, 150)}`);
    return { executed: false, status: "failed", skipReason: e.message?.slice(0, 100) };
  }
}

// ── Shadow P&L: Backfill ─────────────────────────────────
const SHADOW_INTERVAL = 60_000; // Update shadow prices every 60s

async function backfillShadow(traders: any[]) {
  let total = 0;
  for (const trader of traders) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(`${DATA_API}/activity?user=${trader.address}&type=TRADE&limit=50`, {
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;

      for (const trade of data) {
        const id = `shadow-${trader.address.slice(2, 10)}-${trade.transactionHash || uid()}`;
        await db.upsertShadowPosition(id, {
          traderAddress: trader.address,
          traderLabel: trader.label || trader.address.slice(0, 8),
          market: trade.title || "",
          conditionId: trade.conditionId || "",
          tokenId: trade.asset || "",
          side: trade.side || "BUY",
          outcome: trade.outcome || "",
          entryPrice: Number(trade.price || 0),
          currentPrice: Number(trade.price || 0),
          entrySize: Number(trade.usdcSize || trade.size || 0),
          shares: Number(trade.size || 0),
          shadowPnl: 0,
          timestamp: (trade.timestamp || 0) * 1000,
          detectedAt: Date.now(),
        }, USER_ID);
        total++;
      }
    } catch (e: any) {
      log("error", `Shadow backfill ${trader.label || trader.address.slice(0, 8)}: ${e.message?.slice(0, 80)}`);
    }
  }
  log("info", `📊 Shadow backfill complete: ${total} positions from ${traders.length} traders`);
  return total;
}

// ── Shadow P&L: Update Prices ────────────────────────────
async function updateShadowPrices() {
  if (!USER_ID) return;
  try {
    const positions = await db.getOpenShadowPositions(USER_ID);
    if (!positions.length) return;

    // Group by tokenId
    const tokenIds = [...new Set(positions.map(p => p.tokenId).filter(Boolean))];
    const priceMap = new Map<string, number>();

    // Fetch prices individually via midpoint endpoint
    for (const tid of tokenIds) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${CLOB_URL}/midpoint?token_id=${tid}`, {
          headers: { Accept: "application/json" },
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (res.ok) {
          const data = await res.json();
          const mid = Number(data?.mid ?? data?.price ?? data);
          if (mid > 0 && mid <= 1) priceMap.set(tid, mid);
        }
      } catch {}
    }

    // Update positions
    let updated = 0;
    let totalPnl = 0;
    for (const pos of positions) {
      const currentPrice = priceMap.get(pos.tokenId) ?? pos.currentPrice;
      let pnl = 0;
      if (pos.side === "BUY") {
        pnl = (currentPrice - pos.entryPrice) * pos.shares;
      } else {
        pnl = (pos.entryPrice - currentPrice) * pos.shares;
      }
      totalPnl += pnl;
      await db.updateShadowPrice(pos.id, currentPrice, pnl);
      updated++;
    }

    const traderCount = new Set(positions.map(p => p.traderAddress)).size;
    log("info", `📈 Shadow: ${priceMap.size} prices | ${traderCount} traders | ${updated} pos | Total: $${totalPnl.toFixed(2)}`);
  } catch (e: any) {
    log("error", `Shadow update error: ${e.message?.slice(0, 100)}`);
  }
}

// ── Main Loop ────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║       PolyCopy Bot v4.0 (Prisma)     ║");
  console.log("║       Real CLOB Execution            ║");
  console.log("╚══════════════════════════════════════╝");

  // Auto-detect user if not set
  if (!USER_ID) {
    const user = await db.getFirstUser();
    if (user) {
      USER_ID = user.id;
      log("info", `Auto-detected user: ${user.email} (${USER_ID})`);
    } else {
      console.error("No users found. Sign up on the dashboard first, then restart the bot.");
      process.exit(1);
    }
  }

  const hasKey = KEY.length > 10;
  log("info", `Starting | CLOB: ${CLOB_URL} | Poll: ${POLL}ms | Key: ${hasKey ? "YES" : "DRY RUN"}`);

  // Initialize CLOB client
  if (hasKey) {
    const ok = await initClobClient();
    if (ok) log("info", "✅ CLOB client ready — LIVE EXECUTION ENABLED");
    else log("warn", "CLOB client failed — falling back to DRY RUN");
  }

  // Initialize bot status
  await db.updateBotStatus(USER_ID, {
    running: 1, started_at: Date.now(), last_poll: 0,
    poll_count: 0, trades_detected: 0, trades_copied: 0, errors: 0,
  });

  // Get tracked wallets
  let tracked = await db.getTrackedTraders(USER_ID);
  const nowSec = Math.floor(Date.now() / 1000);
  for (const t of tracked) lastSeen.set(t.address, nowSec);
  log("info", `Tracking ${tracked.length} wallets: ${tracked.map(t => t.label || t.address.slice(0, 8)).join(", ") || "none"}`);

  const initConfig = await db.getConfig(USER_ID);
  log("info", `Execution mode: ${initConfig.executionMode.toUpperCase()} | ${clobClient ? "CLOB LIVE" : "DRY RUN"}`);

  if (tracked.length === 0) {
    log("warn", "No tracked wallets. Go to Discover → Track some traders first.");
  }

  // Initialize Telegram
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    initTelegram(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID);
    if (tgEnabled()) {
      log("info", "📱 Telegram alerts enabled");
      setInterval(() => pollCallbacks?.(), 2000);
    }
  }

  // Shadow backfill on first run
  const shadowCount = await db.getShadowCount(USER_ID);
  if (shadowCount === 0 && tracked.length > 0) {
    log("info", "Shadow P&L: No positions found, running initial backfill...");
    await backfillShadow(tracked);
  }

  // Shadow price update interval
  setInterval(updateShadowPrices, SHADOW_INTERVAL);

  let pollCount = 0;
  let totalDetectedAll = 0;
  let totalCopiedAll = 0;
  let errorCount = 0;

  // ── Poll Loop ──────────────────────────────────────────
  setInterval(async () => {
    try {
      const config = await db.getConfig(USER_ID);
      tracked = await db.getTrackedTraders(USER_ID);
      pollCount++;

      await db.updateBotStatus(USER_ID, {
        last_poll: Date.now(), poll_count: pollCount,
      });

      let totalDetected = 0;
      let totalCopied = 0;

      // 1. Process approved trades (manual mode)
      const approved = (await db.prisma.copyTrade.findMany({
        where: { userId: USER_ID, status: "approved" },
      }));
      for (const trade of approved) {
        log("info", `✅ Executing approved trade: ${trade.outcome} on "${trade.market}"`);
        const mockTrade = {
          side: trade.outcome || "BUY",
          price: trade.originalPrice || trade.executedPrice,
          usdcSize: trade.originalSize || trade.copySize,
          tokenId: trade.tokenId || "",
          market: trade.market,
          outcome: trade.outcome,
          label: trade.sourceLabel || "unknown",
          allocation: 100,
        };
        const result = await executeCopy(mockTrade, config);
        const newStatus = result.status === "dry_run" ? "dry_run" : result.executed ? "executed" : "failed";
        await db.updateCopyTrade(trade.id, {
          status: newStatus,
          approvedAt: Date.now(),
          skipReason: result.skipReason || "",
        });
        if (result.executed) totalCopied++;
      }

      // 2. Detect new trades from tracked wallets
      for (const trader of tracked) {
        const newTrades = await pollWallet(
          trader.address,
          trader.label || trader.address.slice(0, 8),
          trader.copyAllocation || 100
        );

        if (newTrades.length > 0) {
          totalDetected += newTrades.length;
          log("info", `🔔 ${newTrades.length} new trade(s) from ${trader.label || trader.address.slice(0, 8)}`);

          for (const trade of newTrades) {
            // Apply smart filters
            const filter = applySmartFilters(trade, config);
            if (!filter.pass) {
              log("info", `🚫 Filtered: ${filter.reason} — ${trade.label} ${trade.side} on "${trade.market}"`);
              if (tgEnabled()) sendFilterNotice?.({ traderLabel: trade.label, market: trade.market, side: trade.side, originalSize: trade.usdcSize, skipReason: filter.reason });

              // Still record as shadow position
              const shadowId = `shadow-${trade.address.slice(2, 10)}-${trade.tradeId}`;
              await db.upsertShadowPosition(shadowId, {
                traderAddress: trade.address,
                traderLabel: trade.label,
                market: trade.market,
                conditionId: trade.conditionId,
                tokenId: trade.tokenId,
                side: trade.side,
                outcome: trade.outcome,
                entryPrice: trade.price,
                currentPrice: trade.price,
                entrySize: trade.usdcSize,
                shares: trade.size,
                shadowPnl: 0,
                timestamp: trade.timestamp,
                detectedAt: Date.now(),
              }, USER_ID);

              await db.insertCopyTrade({
                id: uid(), sourceWallet: trade.address, sourceLabel: trade.label,
                market: trade.market, conditionId: trade.conditionId,
                tokenId: trade.tokenId, outcome: trade.outcome,
                originalPrice: trade.price, originalSize: trade.usdcSize,
                copySize: 0, status: "filtered", skipReason: filter.reason,
                timestamp: trade.timestamp || Date.now(),
              }, USER_ID);
              continue;
            }

            // Conviction check
            const convMult = checkConviction(trade, config);
            const copyPct = (config.copyPercentage / 100) * convMult;
            const copySize = trade.usdcSize * copyPct * (trade.allocation / 100);

            // Record shadow position
            const shadowId = `shadow-${trade.address.slice(2, 10)}-${trade.tradeId}`;
            await db.upsertShadowPosition(shadowId, {
              traderAddress: trade.address,
              traderLabel: trade.label,
              market: trade.market,
              conditionId: trade.conditionId,
              tokenId: trade.tokenId,
              side: trade.side,
              outcome: trade.outcome,
              entryPrice: trade.price,
              currentPrice: trade.price,
              entrySize: trade.usdcSize,
              shares: trade.size,
              shadowPnl: 0,
              timestamp: trade.timestamp,
              detectedAt: Date.now(),
            }, USER_ID);

            if (config.executionMode === "manual") {
              // Manual mode → save as pending
              await db.insertCopyTrade({
                id: uid(), sourceWallet: trade.address, sourceLabel: trade.label,
                market: trade.market, conditionId: trade.conditionId,
                tokenId: trade.tokenId, outcome: trade.outcome,
                originalPrice: trade.price, originalSize: trade.usdcSize,
                copySize, status: "pending_approval",
                timestamp: trade.timestamp || Date.now(),
              }, USER_ID);
              log("info", `⏳ [MANUAL] Pending: ${trade.side} $${copySize.toFixed(2)} on "${trade.market}" (${trade.outcome}) — from ${trade.label}${convMult > 1 ? ` [${convMult}x conviction]` : ""}`);

              if (tgEnabled()) {
                sendTradeAlert?.({
                  id: uid(),
                  traderLabel: trade.label,
                  side: trade.side,
                  outcome: trade.outcome,
                  market: trade.market,
                  originalPrice: trade.price,
                  originalSize: trade.usdcSize,
                  copySize,
                  conviction: convMult > 1 ? convMult : undefined,
                });
              }
            } else {
              // Auto mode → execute immediately
              if (config.copyDelay > 0) await new Promise(r => setTimeout(r, config.copyDelay * 1000));

              const result = await executeCopy(trade, config);
              if (result.executed) totalCopied++;

              await db.insertCopyTrade({
                id: uid(), sourceWallet: trade.address, sourceLabel: trade.label,
                market: trade.market, conditionId: trade.conditionId,
                tokenId: trade.tokenId, outcome: trade.outcome,
                originalPrice: trade.price, executedPrice: trade.price,
                originalSize: trade.usdcSize, copySize,
                status: result.status, skipReason: result.skipReason || "",
                timestamp: trade.timestamp || Date.now(),
              }, USER_ID);

              if (tgEnabled() && result.executed) {
                sendExecConfirmation?.({
                  label: trade.label,
                  side: trade.side,
                  outcome: trade.outcome,
                  market: trade.market,
                  price: trade.price,
                  copySize,
                  status: result.status,
                });
              }
            }
          }
        }
      }

      totalDetectedAll += totalDetected;
      totalCopiedAll += totalCopied;

      await db.updateBotStatus(USER_ID, {
        trades_detected: totalDetectedAll,
        trades_copied: totalCopiedAll,
      });

      if (totalDetected > 0) {
        log("info", `Poll #${pollCount}: ${totalDetected} detected, ${totalCopied} copied`);
      }
    } catch (e: any) {
      errorCount++;
      log("error", `Poll error: ${e.message?.slice(0, 200)}`);
      await db.updateBotStatus(USER_ID, { errors: errorCount }).catch(() => {});
    }
  }, POLL);

  // Periodic status log
  setInterval(() => {
    log("info", `Status: ${tracked.length} wallets | ${pollCount} polls | ${totalDetectedAll} detected | ${totalCopiedAll} copied | ${errorCount} errors`);
  }, 300_000); // Every 5 minutes
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
