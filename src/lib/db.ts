import prisma from "./prisma";

// == Traders ==
export async function upsertTrader(t: any, userId: string) {
  return prisma.trader.upsert({
    where: { address_userId: { address: t.address, userId } },
    update: {
      label: t.label ?? undefined, totalTrades: t.totalTrades ?? undefined,
      winCount: t.winCount ?? undefined, lossCount: t.lossCount ?? undefined,
      winRate: t.winRate ?? undefined, totalPnl: t.totalPnl ?? undefined,
      avgTradeSize: t.avgTradeSize ?? undefined, roi: t.roi ?? undefined,
      lastActive: t.lastActive ?? undefined, marketsTraded: t.marketsTraded ?? undefined,
      longestWinStreak: t.longestWinStreak ?? undefined, maxDrawdown: t.maxDrawdown ?? undefined,
      sharpeRatio: t.sharpeRatio ?? undefined, score: t.score ?? undefined,
      tracked: t.tracked ?? undefined, status: t.status ?? undefined,
      copyAllocation: t.copyAllocation ?? undefined,
    },
    create: {
      address: t.address, userId, label: t.label || "",
      totalTrades: t.totalTrades || 0, winCount: t.winCount || 0,
      lossCount: t.lossCount || 0, winRate: t.winRate || 0,
      totalPnl: t.totalPnl || 0, avgTradeSize: t.avgTradeSize || 0,
      roi: t.roi || 0, lastActive: t.lastActive || 0,
      marketsTraded: t.marketsTraded || 0, longestWinStreak: t.longestWinStreak || 0,
      maxDrawdown: t.maxDrawdown || 0, sharpeRatio: t.sharpeRatio || 0,
      score: t.score || 0, tracked: !!t.tracked, status: t.status || "active",
      copyAllocation: t.copyAllocation || 100,
    },
  });
}

export async function getTraders(opts?: { tracked?: boolean; limit?: number; orderBy?: string }, userId?: string) {
  if (!userId) return [];
  const where: any = { userId };
  if (opts?.tracked !== undefined) where.tracked = opts.tracked;
  return prisma.trader.findMany({ where, orderBy: { [opts?.orderBy || "score"]: "desc" }, take: opts?.limit || 100 });
}

export async function setTraderTracked(addr: string, tracked: boolean, alloc = 100, userId?: string) {
  if (!userId) return;
  await prisma.trader.update({ where: { address_userId: { address: addr, userId } }, data: { tracked, copyAllocation: alloc, addedAt: tracked ? new Date() : undefined } }).catch(() => {});
}

export async function setTraderStatus(addr: string, status: "active" | "paused", userId?: string) {
  if (!userId) return;
  await prisma.trader.update({ where: { address_userId: { address: addr, userId } }, data: { status } }).catch(() => {});
}

// == Copy Trades ==
export async function insertCopyTrade(t: any, userId?: string) {
  if (!userId) return;
  await prisma.copyTrade.create({ data: {
    id: t.id, userId, timestamp: t.timestamp || Date.now(),
    sourceTradeId: t.sourceTradeId || null,
    sourceWallet: t.sourceWallet || "", sourceLabel: t.sourceLabel || "",
    market: t.market || "", conditionId: t.conditionId || "",
    tokenId: t.tokenId || "", outcome: t.outcome || "",
    originalPrice: t.originalPrice || 0, executedPrice: t.executedPrice || 0,
    slippage: t.slippage || 0, originalSize: t.originalSize || 0,
    copySize: t.copySize || 0, cost: t.cost || 0,
    status: t.status || "pending", skipReason: t.skipReason || "",
    pnl: t.pnl || 0, resolved: !!t.resolved,
  }}).catch(() => {});
}

export async function getCopyTrades(opts?: { limit?: number; status?: string; wallet?: string }, userId?: string) {
  if (!userId) return [];
  const where: any = { userId };
  if (opts?.status && opts.status !== "all") where.status = opts.status;
  if (opts?.wallet) where.sourceWallet = opts.wallet;
  return prisma.copyTrade.findMany({ where, orderBy: { timestamp: "desc" }, take: opts?.limit || 100 });
}

export async function updateCopyTrade(id: string, data: any) {
  return prisma.copyTrade.update({ where: { id }, data }).catch(() => {});
}

// == Config ==
function parseConfig(m: Record<string, string>) {
  return {
    executionMode: (m.executionMode as any) ?? "manual",
    maxPositionSize: Number(m.maxPositionSize ?? 500),
    maxDailyExposure: Number(m.maxDailyExposure ?? 5000),
    minWinRate: Number(m.minWinRate ?? 0.55),
    copyPercentage: Number(m.copyPercentage ?? 50),
    slippageTolerance: Number(m.slippageTolerance ?? 3),
    riskLevel: (m.riskLevel as any) ?? "medium",
    maxMarkets: Number(m.maxMarkets ?? 10),
    minLiquidity: Number(m.minLiquidity ?? 50000),
    excludedCategories: m.excludedCategories ? JSON.parse(m.excludedCategories) : [],
    copyDelay: Number(m.copyDelay ?? 2),
    staleCopyTimeout: Number(m.staleCopyTimeout ?? 30),
    trailingStop: m.trailingStop === "true",
    trailingStopPct: Number(m.trailingStopPct ?? 15),
    enableNotifications: m.enableNotifications !== "false",
    enableTelegram: m.enableTelegram === "true",
    autoDiscoverTraders: m.autoDiscoverTraders !== "false",
    discoveryMinTrades: Number(m.discoveryMinTrades ?? 20),
    discoveryMinWinRate: Number(m.discoveryMinWinRate ?? 0.6),
    discoveryMinPnl: Number(m.discoveryMinPnl ?? 1000),
    minTradeSize: Number(m.minTradeSize ?? 50),
    excludeCategories: m.excludeCategories || "",
    skipLowPrice: Number(m.skipLowPrice ?? 0.03),
    skipHighPrice: Number(m.skipHighPrice ?? 0.97),
    onlySide: m.onlySide || "both",
    maxTradeAge: Number(m.maxTradeAge ?? 120),
    convictionMinRepeats: Number(m.convictionMinRepeats ?? 2),
    convictionWindow: Number(m.convictionWindow ?? 3600),
    convictionMultiplier: Number(m.convictionMultiplier ?? 1.5),
  };
}

export async function getConfig(userId?: string) {
  if (!userId) return parseConfig({});
  const rows = await prisma.config.findMany({ where: { userId } });
  const m: Record<string, string> = {};
  rows.forEach((r: any) => { m[r.key] = r.value; });
  return parseConfig(m);
}

export async function setConfigValue(key: string, value: string, userId?: string) {
  if (!userId) return;
  await prisma.config.upsert({ where: { key_userId: { key, userId } }, update: { value }, create: { key, value, userId } });
}

// == Logs ==
export async function addLog(level: string, message: string, data?: any, userId?: string) {
  if (!userId) return;
  await prisma.log.create({ data: { userId, level, message, data: data ? JSON.stringify(data) : null } });
  const count = await prisma.log.count({ where: { userId } });
  if (count > 600) {
    const old = await prisma.log.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: count - 500, select: { id: true } });
    if (old.length) await prisma.log.deleteMany({ where: { id: { in: old.map((l: any) => l.id) } } });
  }
}

export async function getLogs(limit = 100, userId?: string) {
  if (!userId) return [];
  const rows = await prisma.log.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
  return rows.map((r: any) => ({ id: r.id, timestamp: r.createdAt.getTime(), level: r.level, message: r.message, data: r.data }));
}

// == Bot Status ==
export async function getBotStatus(userId?: string) {
  const def = { running: 0, started_at: null as number | null, last_poll: null as number | null, poll_count: 0, trades_detected: 0, trades_copied: 0, errors: 0 };
  if (!userId) return def;
  const row = await prisma.botStatus.findUnique({ where: { userId } });
  if (!row) return def;
  return { running: row.running ? 1 : 0, started_at: row.startedAt?.getTime() || null, last_poll: row.lastPoll?.getTime() || null, poll_count: row.pollCount, trades_detected: row.tradesDetected, trades_copied: row.tradesCopied, errors: row.errors };
}

export async function updateBotStatus(u: Record<string, any>, userId?: string) {
  if (!userId) return;
  const data: any = {};
  if (u.running !== undefined) data.running = !!u.running;
  if (u.started_at) data.startedAt = new Date(u.started_at);
  if (u.last_poll) data.lastPoll = new Date(u.last_poll);
  if (u.poll_count !== undefined) data.pollCount = u.poll_count;
  if (u.trades_detected !== undefined) data.tradesDetected = u.trades_detected;
  if (u.trades_copied !== undefined) data.tradesCopied = u.trades_copied;
  if (u.errors !== undefined) data.errors = u.errors;
  await prisma.botStatus.upsert({ where: { userId }, update: data, create: { userId, ...data } });
}

// == Analytics ==
export async function getDailyPnl(days = 30, userId?: string) {
  if (!userId) return [];
  const since = Date.now() - days * 86400000;
  const rows = await prisma.copyTrade.findMany({ where: { userId, status: "executed", timestamp: { gte: since } }, orderBy: { timestamp: "asc" } });
  const byDay: Record<string, { pnl: number; trades: number; wins: number }> = {};
  rows.forEach((t: any) => { const d = new Date(t.timestamp).toISOString().split("T")[0]; if (!byDay[d]) byDay[d] = { pnl: 0, trades: 0, wins: 0 }; byDay[d].pnl += t.pnl; byDay[d].trades++; if (t.pnl > 0) byDay[d].wins++; });
  let cum = 0;
  return Object.entries(byDay).sort().map(([date, d]) => { cum += d.pnl; return { date, pnl: d.pnl, cumPnl: cum, trades: d.trades, wins: d.wins }; });
}

export async function getRiskSnapshot(userId?: string) {
  const def = { totalExposure: 0, dailyExposure: 0, openPositions: 0, dailyPnl: 0, totalPnl: 0, winRate: 0, profitFactor: 0, totalTrades: 0, todayTrades: 0 };
  if (!userId) return def;
  const todayStart = new Date(new Date().toISOString().split("T")[0]).getTime();
  const ex = await prisma.copyTrade.findMany({ where: { userId, status: "executed" } });
  const td = ex.filter((t: any) => t.timestamp >= todayStart);
  const totalPnl = ex.reduce((s: number, t: any) => s + t.pnl, 0);
  const dailyPnl = td.reduce((s: number, t: any) => s + t.pnl, 0);
  const wins = ex.filter((t: any) => t.pnl > 0);
  const losses = ex.filter((t: any) => t.pnl < 0);
  const avgW = wins.length ? wins.reduce((s: number, t: any) => s + t.pnl, 0) / wins.length : 0;
  const avgL = losses.length ? Math.abs(losses.reduce((s: number, t: any) => s + t.pnl, 0) / losses.length) : 1;
  return { totalExposure: ex.reduce((s: number, t: any) => s + t.cost, 0), dailyExposure: td.reduce((s: number, t: any) => s + t.cost, 0), openPositions: ex.filter((t: any) => !t.resolved).length, dailyPnl, totalPnl, winRate: ex.length ? wins.length / ex.length : 0, profitFactor: avgL > 0 ? avgW / avgL : 0, totalTrades: ex.length, todayTrades: td.length };
}

// == Shadow P&L ==
export async function getShadowSummary(userId: string) {
  const positions = await prisma.shadowPosition.findMany({ where: { userId } });
  const tp: Record<string, any> = {};
  for (const pos of positions) {
    const k = pos.traderAddress;
    if (!tp[k]) tp[k] = { label: pos.traderLabel || k.slice(0, 8), totalPnl: 0, trades: 0, wins: 0, losses: 0, openValue: 0 };
    tp[k].totalPnl += pos.shadowPnl || 0; tp[k].trades++;
    if (pos.shadowPnl > 0) tp[k].wins++; else if (pos.shadowPnl < 0) tp[k].losses++;
    tp[k].openValue += (pos.currentPrice || 0) * (pos.shares || 0);
  }
  const summary = Object.entries(tp).map(([addr, d]: [string, any]) => ({
    address: addr, label: d.label, shadowPnl: Math.round(d.totalPnl * 100) / 100,
    trades: d.trades, wins: d.wins, losses: d.losses,
    winRate: d.trades > 0 ? d.wins / d.trades : 0,
    openValue: Math.round(d.openValue * 100) / 100,
  })).sort((a, b) => b.shadowPnl - a.shadowPnl);
  return { summary, totalPnl: Math.round(summary.reduce((s, t) => s + t.shadowPnl, 0) * 100) / 100, totalTrades: positions.length };
}

export async function getShadowPositions(userId: string, traderAddress: string) {
  return prisma.shadowPosition.findMany({ where: { userId, traderAddress }, orderBy: { detectedAt: "desc" } });
}

export { prisma };
