export interface Trader {
  address: string; label: string; totalTrades: number; winCount: number; lossCount: number;
  winRate: number; totalPnl: number; avgTradeSize: number; roi: number; lastActive: number;
  marketsTraded: number; longestWinStreak: number; maxDrawdown: number; sharpeRatio: number;
  score: number; tracked: boolean; status: "active"|"paused"; copyAllocation: number; addedAt: number|null;
}
export interface CopyTrade {
  id: string; timestamp: number; sourceTradeId: string; sourceWallet: string; sourceLabel: string;
  market: string; conditionId: string; tokenId: string; outcome: "YES"|"NO";
  originalPrice: number; executedPrice: number; slippage: number; originalSize: number;
  copySize: number; cost: number; status: "executed"|"pending"|"pending_approval"|"approved"|"rejected"|"failed"|"skipped"|"dry_run";
  skipReason: string|null; pnl: number; resolved: boolean;
}
export interface Market {
  conditionId: string; questionId: string; question: string; slug: string; category: string;
  endDate: string; active: boolean; closed: boolean; volume: number; liquidity: number;
  yesPrice: number; noPrice: number; yesToken: string; noToken: string; imageUrl: string;
}
export interface BotConfig {
  executionMode: "manual"|"auto"; maxPositionSize: number; maxDailyExposure: number; minWinRate: number; copyPercentage: number;
  slippageTolerance: number; riskLevel: "conservative"|"medium"|"aggressive"; maxMarkets: number;
  minLiquidity: number; excludedCategories: string[]; copyDelay: number; staleCopyTimeout: number;
  trailingStop: boolean; trailingStopPct: number; enableNotifications: boolean; enableTelegram: boolean;
  autoDiscoverTraders: boolean; discoveryMinTrades: number; discoveryMinWinRate: number; discoveryMinPnl: number;
}
export interface PnlPoint { date: string; pnl: number; cumPnl: number; trades: number; wins: number; }
export interface LogEntry { id: string; timestamp: number; level: "info"|"warn"|"error"|"trade"; message: string; data?: string; }
export type TabId = "dashboard"|"discover"|"wallets"|"trades"|"analytics"|"risk"|"settings"|"logs";
