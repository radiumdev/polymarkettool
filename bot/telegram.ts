/**
 * PolyCopy Telegram Bot — Multi-User with Password Auth
 * /start → Welcome
 * /login <email> <password> → Links Telegram to account
 * /status → Shows tracked wallets + shadow P&L
 * /unlink → Disconnects Telegram
 */

import * as db from "./db";

const TG_API = "https://api.telegram.org/bot";
let BOT_TOKEN = "";
let lastUpdateId = 0;

export function initTelegram(token: string) {
  BOT_TOKEN = token;
  if (!BOT_TOKEN) {
    console.log("[Telegram] No TELEGRAM_BOT_TOKEN — alerts disabled");
    return false;
  }
  console.log(`[Telegram] Bot initialized | Token: ${BOT_TOKEN.slice(0, 8)}...`);
  return true;
}

export function isEnabled() { return !!BOT_TOKEN; }

async function tg(method: string, body?: any): Promise<any> {
  try {
    const res = await fetch(`${TG_API}${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (!txt.includes("409")) console.log(`[Telegram] ${method} failed: ${res.status} ${txt.slice(0, 100)}`);
      return null;
    }
    return res.json();
  } catch (e: any) {
    console.log(`[Telegram] ${method} error: ${e.message?.slice(0, 80)}`);
    return null;
  }
}

async function sendTo(chatId: string, text: string, markup?: any): Promise<number | null> {
  const result = await tg("sendMessage", {
    chat_id: chatId, text, parse_mode: "HTML",
    ...(markup ? { reply_markup: markup } : {}),
  });
  return result?.result?.message_id || null;
}

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── /start ─────────────────────────────────────────────────
async function handleStart(chatId: string) {
  const existing = await db.getUserByTelegramChat(chatId);
  if (existing) {
    await sendTo(chatId, [
      `✅ <b>Logged in</b> as <b>${esc(existing.email)}</b>`,
      ``,
      `You'll receive trade alerts here automatically.`,
      ``,
      `/status — Your wallets & P&L`,
      `/unlink — Disconnect`,
    ].join("\n"));
    return;
  }

  await sendTo(chatId, [
    `⚡ <b>Welcome to PolyCopy Bot!</b>`,
    ``,
    `Copy-trade Polymarket whales with real-time alerts.`,
    ``,
    `<b>Login with your PolyCopy account:</b>`,
    `/login your@email.com yourpassword`,
    ``,
    `<i>Your password is used once to verify and never stored in chat.</i>`,
    ``,
    `Don't have an account? Sign up at your PolyCopy dashboard first.`,
  ].join("\n"));
}

// ── /login <email> <password> ──────────────────────────────
async function handleLogin(chatId: string, email: string, password: string, msgId: number) {
  console.log(`[TG] handleLogin called: chatId=${chatId} email=${email} pwd=${password ? "***" : "EMPTY"}`);
  if (!email || !password) {
    await sendTo(chatId, "❌ Usage: /login your@email.com yourpassword");
    return;
  }

  // Delete the user's message containing the password immediately
  await tg("deleteMessage", { chat_id: chatId, message_id: msgId }).catch(() => {});

  try {
    const existing = await db.getUserByTelegramChat(chatId);
    if (existing) {
      await sendTo(chatId, `Already logged in as <b>${esc(existing.email)}</b>. Send /unlink first to switch accounts.`);
      return;
    }

    // Verify credentials
    const user = await db.authenticateUser(email, password);
    if (!user) {
      await sendTo(chatId, "❌ Invalid email or password. Try again.");
      return;
    }

    // Link telegram
    await db.linkTelegram(user.id, chatId);

    await sendTo(chatId, [
    `✅ <b>Logged in!</b>`,
    ``,
    `Welcome, <b>${esc(user.name)}</b>! 🎉`,
    ``,
    `You'll now receive alerts for:`,
    `• 🔔 New whale trades from your tracked wallets`,
    `• ⏳ Trades needing approval (manual mode)`,
    `• ✅ Executed trades`,
    ``,
    `/status — Your wallets & P&L`,
    `/unlink — Disconnect`,
  ].join("\n"));
  } catch (e: any) {
    console.error("[Telegram] Login error:", e.message, e.stack);
    await sendTo(chatId, `❌ Login error: ${(e.message || "unknown").slice(0, 100)}. Try again.`);
  }
}

// ── /status ────────────────────────────────────────────────
async function handleStatus(chatId: string) {
  const user = await db.getUserByTelegramChat(chatId);
  if (!user) {
    await sendTo(chatId, "❌ Not logged in. Send /login email password");
    return;
  }

  const tracked = await db.getTrackedTraders(user.id);
  const shadows = await db.getAllShadowPositions(user.id);
  const totalPnl = shadows.reduce((s, p) => s + (p.shadowPnl || 0), 0);

  const walletLines = tracked.length > 0
    ? tracked.map(t => `• <b>${esc(t.label || t.address.slice(0, 8))}</b> — ${t.status}`).join("\n")
    : "<i>No wallets tracked</i>";

  await sendTo(chatId, [
    `📊 <b>Your PolyCopy Status</b>`,
    ``,
    `👤 ${esc(user.email)} (${user.plan || "free"} plan)`,
    `👛 <b>${tracked.length}</b> tracked wallets`,
    `📈 <b>${shadows.length}</b> shadow positions`,
    `💰 Shadow P&L: <b>${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}</b>`,
    ``,
    `<b>Wallets:</b>`,
    walletLines,
  ].join("\n"));
}

// ── /unlink ────────────────────────────────────────────────
async function handleUnlink(chatId: string) {
  const user = await db.unlinkTelegram(chatId);
  if (!user) {
    await sendTo(chatId, "Not logged in.");
    return;
  }
  await sendTo(chatId, `✅ Logged out from <b>${esc(user.email)}</b>. Send /login to connect again.`);
}

// ── Poll for messages + callbacks ──────────────────────────
export async function pollUpdates(): Promise<void> {
  if (!isEnabled()) return;

  const result = await tg("getUpdates", {
    offset: lastUpdateId + 1,
    timeout: 0,
    allowed_updates: ["message", "callback_query"],
  });

  if (!result?.result?.length) return;

  for (const update of result.result) {
    lastUpdateId = Math.max(lastUpdateId, update.update_id);

    const msg = update.message;
    if (msg?.text) {
      const chatId = String(msg.chat.id);
      const text = msg.text.trim();
      const [cmd, ...args] = text.split(/\s+/);

      switch (cmd.toLowerCase().replace(/@.*$/, "")) {
        case "/start":
          console.log(`[TG] Received /start from ${chatId}`);
          await handleStart(chatId);
          break;
        case "/login":
          console.log(`[TG] Received /login from ${chatId}, email=${args[0]}`);
          await handleLogin(chatId, args[0] || "", args.slice(1).join(" ") || "", msg.message_id);
          break;
        case "/status":
          await handleStatus(chatId);
          break;
        case "/unlink":
        case "/logout":
          await handleUnlink(chatId);
          break;
        default:
          break;
      }
    }

    // Handle callback queries (approve/reject buttons)
    const cb = update.callback_query;
    if (cb?.data) {
      const chatId = String(cb.message?.chat?.id || "");
      const user = await db.getUserByTelegramChat(chatId);
      if (!user) {
        await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Not logged in!", show_alert: true });
        continue;
      }

      const [action, tradeId] = cb.data.split(":");
      if (action && tradeId) {
        const emoji = action === "approve" ? "✅" : "❌";
        await tg("answerCallbackQuery", { callback_query_id: cb.id, text: `${emoji} ${action === "approve" ? "Approved" : "Rejected"}!` });

        const newStatus = action === "approve" ? "approved" : "rejected";
        await db.updateCopyTrade(tradeId, { status: newStatus });

        if (cb.message?.message_id) {
          const original = cb.message?.text || "";
          const statusLine = action === "approve"
            ? "\n\n✅ <b>APPROVED</b> — executing..."
            : "\n\n❌ <b>REJECTED</b>";
          await tg("editMessageText", {
            chat_id: chatId, message_id: cb.message.message_id,
            text: esc(original) + statusLine, parse_mode: "HTML",
          });
        }
      }
    }
  }
}

// ── Per-User Alert Senders ────────────────────────────────

export async function sendTradeAlertToUser(userId: string, trade: {
  traderLabel: string; market: string; outcome: string; side: string;
  copySize: number; originalSize: number; originalPrice: number;
  conviction?: number; tradeId?: string;
}) {
  const user = await db.prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true, telegramLinked: true },
  });
  if (!user?.telegramLinked || !user?.telegramChatId) return;

  const sideEmoji = trade.side === "BUY" ? "🟢" : "🔴";
  const convBadge = trade.conviction && trade.conviction > 1 ? ` 🔥 x${trade.conviction}` : "";
  const tid = trade.tradeId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const text = [
    `${sideEmoji} <b>New Whale Trade</b>${convBadge}`,
    ``,
    `👤 <b>${esc(trade.traderLabel)}</b>`,
    `📊 ${esc(trade.market)}`,
    `🎯 <b>${trade.side}</b> ${trade.outcome} @ ${trade.originalPrice.toFixed(3)}`,
    `💰 Whale: $${trade.originalSize.toFixed(2)} → Copy: <b>$${trade.copySize.toFixed(2)}</b>`,
  ].join("\n");

  const markup = {
    inline_keyboard: [[
      { text: "✅ Approve", callback_data: `approve:${tid}` },
      { text: "❌ Reject", callback_data: `reject:${tid}` },
    ]],
  };

  await sendTo(user.telegramChatId, text, markup);
}

export async function sendFilterNoticeToUser(userId: string, trade: {
  traderLabel: string; market: string; side: string; originalSize: number; skipReason: string;
}) {
  const user = await db.prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true, telegramLinked: true },
  });
  if (!user?.telegramLinked || !user?.telegramChatId) return;
  if (trade.originalSize < 500) return;

  await sendTo(user.telegramChatId, [
    `🚫 <b>Filtered</b>`,
    `${esc(trade.traderLabel)}: ${trade.side} $${trade.originalSize.toFixed(0)} on "${esc(trade.market)}"`,
    `Reason: <i>${esc(trade.skipReason)}</i>`,
  ].join("\n"));
}

export async function sendExecToUser(userId: string, trade: {
  market: string; side: string; copySize: number; status: string;
}) {
  const user = await db.prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true, telegramLinked: true },
  });
  if (!user?.telegramLinked || !user?.telegramChatId) return;

  const emoji = trade.status === "executed" ? "✅" : trade.status === "dry_run" ? "📋" : "❌";
  await sendTo(user.telegramChatId, `${emoji} <b>${trade.status.toUpperCase()}</b>: ${trade.side} $${trade.copySize.toFixed(2)} on "${esc(trade.market)}"`);
}
