import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();

export async function getTrackedTraders(userId: string) {
  return prisma.trader.findMany({ where: { userId, tracked: true, status: "active" } });
}

export async function getConfig(userId: string) {
  const rows = await prisma.config.findMany({ where: { userId } });
  const m: Record<string, string> = {};
  rows.forEach(r => { m[r.key] = r.value; });
  return {
    executionMode: m.executionMode ?? "manual", maxPositionSize: Number(m.maxPositionSize ?? 500),
    maxDailyExposure: Number(m.maxDailyExposure ?? 5000), copyPercentage: Number(m.copyPercentage ?? 50),
    slippageTolerance: Number(m.slippageTolerance ?? 3), enableTelegram: m.enableTelegram === "true",
    minTradeSize: Number(m.minTradeSize ?? 50), excludeCategories: m.excludeCategories || "",
    skipLowPrice: Number(m.skipLowPrice ?? 0.03), skipHighPrice: Number(m.skipHighPrice ?? 0.97),
    onlySide: m.onlySide || "both", maxTradeAge: Number(m.maxTradeAge ?? 120), copyDelay: Number(m.copyDelay ?? 2),
    convictionMinRepeats: Number(m.convictionMinRepeats ?? 2),
    convictionWindow: Number(m.convictionWindow ?? 3600),
    convictionMultiplier: Number(m.convictionMultiplier ?? 1.5),
  };
}

export async function insertCopyTrade(trade: any, userId: string) {
  return prisma.copyTrade.create({ data: {
    id: trade.id, userId, timestamp: trade.timestamp || Date.now(), sourceTradeId: trade.sourceTradeId || null,
    sourceWallet: trade.sourceWallet || "", sourceLabel: trade.sourceLabel || "",
    market: trade.market || "", conditionId: trade.conditionId || "", tokenId: trade.tokenId || "",
    outcome: trade.outcome || "", originalPrice: trade.originalPrice || 0, executedPrice: trade.executedPrice || 0,
    originalSize: trade.originalSize || 0, copySize: trade.copySize || 0, cost: trade.cost || 0,
    status: trade.status || "pending", skipReason: trade.skipReason || "", pnl: trade.pnl || 0,
  }}).catch(e => console.error("Insert trade:", e.message));
}

export async function updateCopyTrade(id: string, data: any) {
  return prisma.copyTrade.update({ where: { id }, data }).catch(() => {});
}

export async function getPendingTrades(userId: string) {
  return prisma.copyTrade.findMany({ where: { userId, status: "pending_approval" } });
}

export async function addLog(userId: string, level: string, message: string) {
  return prisma.log.create({ data: { userId, level, message } }).catch(() => {});
}

export async function updateBotStatus(userId: string, data: any) {
  const d: any = {};
  if (data.running !== undefined) d.running = !!data.running;
  if (data.started_at) d.startedAt = new Date(data.started_at);
  if (data.last_poll) d.lastPoll = new Date(data.last_poll);
  if (data.poll_count !== undefined) d.pollCount = data.poll_count;
  if (data.trades_detected !== undefined) d.tradesDetected = data.trades_detected;
  if (data.trades_copied !== undefined) d.tradesCopied = data.trades_copied;
  if (data.errors !== undefined) d.errors = data.errors;
  return prisma.botStatus.upsert({ where: { userId }, update: d, create: { userId, ...d } });
}

export async function upsertShadowPosition(id: string, data: any, userId: string) {
  return prisma.shadowPosition.upsert({
    where: { id },
    update: { currentPrice: data.currentPrice, shadowPnl: data.shadowPnl },
    create: {
      id, userId, traderAddress: data.traderAddress || "", traderLabel: data.traderLabel || "",
      market: data.market || "", conditionId: data.conditionId || "", tokenId: data.tokenId || "",
      side: data.side || "BUY", outcome: data.outcome || "", entryPrice: data.entryPrice || 0,
      currentPrice: data.currentPrice || 0, entrySize: data.entrySize || 0, shares: data.shares || 0,
      shadowPnl: data.shadowPnl || 0, timestamp: data.timestamp || Date.now(), detectedAt: data.detectedAt || Date.now(),
    },
  }).catch(e => console.error("Shadow upsert:", e.message));
}

export async function getOpenShadowPositions(userId: string) {
  return prisma.shadowPosition.findMany({ where: { userId, resolved: false, tokenId: { not: "" } } });
}

export async function getAllShadowPositions(userId: string) {
  return prisma.shadowPosition.findMany({ where: { userId } });
}

export async function updateShadowPrice(id: string, currentPrice: number, shadowPnl: number) {
  return prisma.shadowPosition.update({ where: { id }, data: { currentPrice, shadowPnl } }).catch(() => {});
}

export async function getShadowCount(userId: string) {
  return prisma.shadowPosition.count({ where: { userId } });
}

export async function getFirstUser() {
  return prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function getAllActiveUsers() {
  // Get all users who have at least one tracked wallet
  const users = await prisma.user.findMany({
    where: { traders: { some: { tracked: true, status: "active" } } },
    select: { id: true, email: true },
  });
  return users;
}
