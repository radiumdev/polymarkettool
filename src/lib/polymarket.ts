import { Market, Trader } from "@/types";

const GAMMA = process.env.POLY_GAMMA_URL || "https://gamma-api.polymarket.com";
const DATA = "https://data-api.polymarket.com";
const CLOB = process.env.POLY_CLOB_URL || "https://clob.polymarket.com";

// ── Helper ──────────────────────────────────────────────────
async function apiFetch(url: string, label: string, timeoutMs = 15000): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) { console.log(`[API] ${label}: ${res.status}`); return null; }
    return res.json();
  } catch (e: any) { console.log(`[API] ${label}: ${e.message?.slice(0, 80)}`); return null; }
}

// ── Gamma API (market data) ─────────────────────────────────
function parseMarket(m: any): Market {
  let prices = m.outcomePrices;
  if (typeof prices === "string") try { prices = JSON.parse(prices); } catch { prices = [0.5, 0.5]; }
  let tids = m.clobTokenIds;
  if (typeof tids === "string") try { tids = JSON.parse(tids); } catch { tids = []; }
  return {
    conditionId: m.conditionId, questionId: m.questionID, question: m.question, slug: m.slug,
    category: m.category || "Other", endDate: m.endDate, active: m.active, closed: m.closed,
    volume: Number(m.volume || 0), liquidity: Number(m.liquidity || 0),
    yesPrice: Number(prices?.[0] || 0.5), noPrice: Number(prices?.[1] || 0.5),
    yesToken: tids?.[0] || "", noToken: tids?.[1] || "", imageUrl: m.image || "",
  };
}

export async function fetchMarkets(limit = 50, offset = 0): Promise<Market[]> {
  const data = await apiFetch(`${GAMMA}/markets?limit=${limit}&offset=${offset}&active=true&closed=false&order=volume&ascending=false`, "Markets");
  return Array.isArray(data) ? data.map(parseMarket) : [];
}
export async function fetchMarket(id: string): Promise<Market | null> {
  const m = await apiFetch(`${GAMMA}/markets/${id}`, "Market");
  return m ? parseMarket(m) : null;
}
export async function fetchOrderBook(tokenId: string) { return apiFetch(`${CLOB}/book?token_id=${tokenId}`, "Book"); }
export async function fetchMidpoint(tokenId: string): Promise<number> {
  const d = await apiFetch(`${CLOB}/midpoint?token_id=${tokenId}`, "Mid");
  return Number(d?.mid || 0.5);
}

// ── Data API: Activity ──────────────────────────────────────
export interface RawTrade {
  proxyWallet: string; timestamp: number; conditionId: string; type: string;
  size: number; usdcSize: number; transactionHash: string; price: number;
  asset: string; side: "BUY" | "SELL"; outcomeIndex: number;
  title: string; slug: string; eventSlug: string; outcome: string;
  name: string; pseudonym: string; profileImage: string;
}

export async function fetchUserActivity(address: string, limit = 100): Promise<RawTrade[]> {
  const data = await apiFetch(`${DATA}/activity?user=${address}&limit=${limit}`, `Activity:${address.slice(0, 8)}`);
  return Array.isArray(data) ? data : [];
}

// ── Data API: LIVE Leaderboard ──────────────────────────────
// Fetches real-time leaderboard from Polymarket's own API
// Returns: rank, proxyWallet, userName, vol, pnl, profileImage
export interface LeaderboardEntry {
  rank: string;
  proxyWallet: string;
  userName: string;
  vol: number;
  pnl: number;
  profileImage: string;
  xUsername?: string;
  verifiedBadge?: boolean;
}

// Cache leaderboard for 5 minutes to avoid hammering
let _lbCache: { data: LeaderboardEntry[]; ts: number } = { data: [], ts: 0 };
const LB_CACHE_TTL = 5 * 60 * 1000;

export async function fetchLeaderboard(
  timePeriod: "DAY" | "WEEK" | "MONTH" | "ALL" = "MONTH",
  orderBy: "PNL" | "VOL" = "PNL",
  limit = 50
): Promise<LeaderboardEntry[]> {
  const cacheKey = `${timePeriod}-${orderBy}-${limit}`;
  if (_lbCache.data.length > 0 && Date.now() - _lbCache.ts < LB_CACHE_TTL) {
    console.log(`[Leaderboard] Using cache (${_lbCache.data.length} entries)`);
    return _lbCache.data;
  }

  console.log(`[Leaderboard] Fetching LIVE: timePeriod=${timePeriod}, orderBy=${orderBy}, limit=${limit}`);
  const data = await apiFetch(
    `${DATA}/v1/leaderboard?timePeriod=${timePeriod}&orderBy=${orderBy}&limit=${limit}&offset=0`,
    "Leaderboard"
  );

  if (Array.isArray(data) && data.length > 0) {
    _lbCache = { data, ts: Date.now() };
    console.log(`[Leaderboard] Got ${data.length} traders. #1: ${data[0]?.userName} ($${data[0]?.pnl?.toLocaleString()} P&L)`);
    return data;
  }

  console.log(`[Leaderboard] API returned empty/null, using stale cache if available`);
  return _lbCache.data;
}

// ── Data API: LIVE Positions (real P&L per wallet) ──────────
export interface Position {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  totalBought: number;
  realizedPnl: number;
  percentRealizedPnl: number;
  curPrice: number;
  redeemable: boolean;
  title: string;
  slug: string;
  outcome: string;
  endDate: string;
}

export async function fetchPositions(address: string, limit = 500): Promise<Position[]> {
  const data = await apiFetch(
    `${DATA}/positions?user=${address}&limit=${limit}&sizeThreshold=0`,
    `Positions:${address.slice(0, 8)}`
  );
  return Array.isArray(data) ? data : [];
}

// Also fetch closed/resolved positions for realized P&L
export async function fetchClosedPositions(address: string, limit = 200): Promise<any[]> {
  const data = await apiFetch(
    `${DATA}/positions/closed?user=${address}&limit=${limit}`,
    `ClosedPos:${address.slice(0, 8)}`
  );
  return Array.isArray(data) ? data : [];
}

// Get total portfolio value
export async function fetchPortfolioValue(address: string): Promise<number> {
  const data = await apiFetch(
    `${DATA}/value?user=${address}`,
    `Value:${address.slice(0, 8)}`
  );
  return Number(data?.value || 0);
}

// ── Build trader profile from LIVE leaderboard + positions ──
async function buildLiveProfile(
  lbEntry: LeaderboardEntry,
  trades: RawTrade[]
): Promise<Partial<Trader>> {
  const addr = lbEntry.proxyWallet;
  const displayName = lbEntry.userName || trades[0]?.name || trades[0]?.pseudonym || `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const markets = new Set(trades.map(t => t.conditionId));
  const lastTs = trades.length > 0 ? Math.max(...trades.map(t => t.timestamp)) : 0;

  // Real data straight from Polymarket API
  const pnl = lbEntry.pnl || 0;
  const volume = lbEntry.vol || 0;
  const rank = Number(lbEntry.rank || 999);
  const roi = volume > 0 ? pnl / volume : 0;

  // Score: rank-based + recency bonus
  const rankScore = Math.max(0, 100 - (rank - 1) * 2); // #1 = 100, #50 = 2
  const daysSince = lastTs > 0 ? (Date.now() / 1000 - lastTs) / 86400 : 999;
  const recencyBonus = daysSince < 1 ? 10 : daysSince < 3 ? 7 : daysSince < 7 ? 3 : 0;
  const score = Math.min(100, rankScore + recencyBonus);

  return {
    address: addr,
    label: displayName,
    totalTrades: trades.length,
    winCount: 0, // Can't determine from activity API
    lossCount: 0,
    winRate: 0,
    totalPnl: Math.round(pnl * 100) / 100, // REAL from leaderboard API
    avgTradeSize: trades.length > 0 ? trades.reduce((s, t) => s + (t.usdcSize || 0), 0) / trades.length : 0,
    roi: Math.round(roi * 10000) / 10000, // REAL: profit/volume
    lastActive: lastTs * 1000,
    marketsTraded: markets.size,
    longestWinStreak: 0, maxDrawdown: 0, sharpeRatio: 0,
    score: Math.round(score * 10) / 10,
    tracked: false,
    status: "active",
    copyAllocation: 100,
    addedAt: null,
  };
}

// ── Build profile for manually-added wallet using positions API ──
async function buildPositionsProfile(address: string, trades: RawTrade[]): Promise<Partial<Trader>> {
  const displayName = trades[0]?.name || trades[0]?.pseudonym || `${address.slice(0, 6)}…${address.slice(-4)}`;
  const markets = new Set(trades.map(t => t.conditionId));
  const lastTs = trades.length > 0 ? Math.max(...trades.map(t => t.timestamp)) : 0;
  const totalVolume = trades.reduce((s, t) => s + (t.usdcSize || 0), 0);

  // Try to get REAL P&L from positions API
  let realPnl = 0;
  let positionCount = 0;
  let totalInvested = 0;

  try {
    const positions = await fetchPositions(address);
    if (positions.length > 0) {
      realPnl = positions.reduce((sum, p) => sum + (p.cashPnl || 0), 0);
      totalInvested = positions.reduce((sum, p) => sum + (p.initialValue || 0), 0);
      positionCount = positions.length;
      console.log(`[Positions] ${address.slice(0, 8)}: ${positions.length} positions, P&L $${realPnl.toFixed(2)}, invested $${totalInvested.toFixed(2)}`);
    }
  } catch (e) {
    console.log(`[Positions] Error fetching for ${address.slice(0, 8)}: ${e}`);
  }

  // Also try leaderboard lookup for this specific user
  let lbPnl = 0;
  let lbVol = 0;
  try {
    const lbData = await apiFetch(
      `${DATA}/v1/leaderboard?timePeriod=MONTH&orderBy=PNL&limit=1&user=${address}`,
      `LB:${address.slice(0, 8)}`
    );
    if (Array.isArray(lbData) && lbData.length > 0) {
      lbPnl = lbData[0].pnl || 0;
      lbVol = lbData[0].vol || 0;
      console.log(`[Leaderboard] ${address.slice(0, 8)}: Monthly P&L $${lbPnl.toFixed(2)}, Vol $${lbVol.toFixed(2)}`);
    }
  } catch {}

  // Use best available P&L data: leaderboard > positions > 0
  const bestPnl = lbPnl !== 0 ? lbPnl : realPnl;
  const bestVol = lbVol > 0 ? lbVol : totalVolume;
  const roi = bestVol > 0 ? bestPnl / bestVol : 0;

  // Score from activity patterns
  const daysSince = lastTs > 0 ? (Date.now() / 1000 - lastTs) / 86400 : 999;
  const recency = daysSince < 1 ? 20 : daysSince < 7 ? 15 : daysSince < 30 ? 8 : 2;
  const volScore = Math.min(30, (bestVol / 100000) * 30);
  const freqScore = Math.min(25, (trades.length / 50) * 25);
  const pnlBonus = bestPnl > 10000 ? 15 : bestPnl > 1000 ? 10 : bestPnl > 0 ? 5 : 0;
  const score = Math.round(Math.min(100, recency + volScore + freqScore + pnlBonus) * 10) / 10;

  return {
    address,
    label: displayName,
    totalTrades: trades.length,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    totalPnl: Math.round(bestPnl * 100) / 100,
    avgTradeSize: trades.length > 0 ? totalVolume / trades.length : 0,
    roi: Math.round(roi * 10000) / 10000,
    lastActive: lastTs * 1000,
    marketsTraded: markets.size,
    longestWinStreak: 0, maxDrawdown: 0, sharpeRatio: 0,
    score,
    tracked: false,
    status: "active",
    copyAllocation: 100,
    addedAt: null,
  };
}

// ── Discovery: LIVE leaderboard → fetch activity for each ───
export async function discoverTraders(opts: { limit?: number } = {}): Promise<Partial<Trader>[]> {
  const { limit = 50 } = opts;
  const results: Partial<Trader>[] = [];
  const seen = new Set<string>();

  // Step 1: Fetch LIVE leaderboard from Polymarket API
  console.log(`[Discovery] Fetching LIVE monthly profit leaderboard...`);
  const leaderboard = await fetchLeaderboard("MONTH", "PNL", limit);

  if (leaderboard.length === 0) {
    console.log(`[Discovery] Leaderboard API returned empty — possibly rate limited`);
    return [];
  }

  console.log(`[Discovery] Got ${leaderboard.length} traders from live leaderboard`);

  // Step 2: Fetch recent activity for each trader
  for (const entry of leaderboard) {
    const addr = entry.proxyWallet;
    if (!addr || seen.has(addr.toLowerCase())) continue;
    seen.add(addr.toLowerCase());

    const trades = await fetchUserActivity(addr, 100);
    const profile = await buildLiveProfile(entry, trades);
    results.push(profile);

    const rank = entry.rank || "?";
    console.log(`[Discovery] #${rank} ${profile.label}: $${entry.pnl?.toLocaleString()} P&L (LIVE), $${entry.vol?.toLocaleString()} vol, ${trades.length} recent trades, score ${profile.score}`);
  }

  console.log(`[Discovery] Total: ${results.length} traders from LIVE leaderboard`);
  return results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
}

// ── Analyze a single address ────────────────────────────────
export async function analyzeAddress(address: string): Promise<Partial<Trader> | null> {
  // First check if they're on the current leaderboard
  const leaderboard = await fetchLeaderboard("MONTH", "PNL", 50);
  const lbEntry = leaderboard.find(e => e.proxyWallet?.toLowerCase() === address.toLowerCase());

  const trades = await fetchUserActivity(address, 200);

  if (trades.length === 0 && !lbEntry) return null;

  if (lbEntry) {
    return buildLiveProfile(lbEntry, trades);
  }

  // Not on leaderboard — use positions API for real P&L
  return buildPositionsProfile(address, trades);
}
