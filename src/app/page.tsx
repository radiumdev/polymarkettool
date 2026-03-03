"use client";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useAPI, apiPost } from "@/lib/hooks";
import { fmt, shortAddr, timeAgo, cn, pct } from "@/lib/utils";
import { Badge, Pnl, Spark, Pill, Tag, Card, Stat, TH, TD, Toggle, LoadingDots, EmptyState } from "@/components/ui";
import { LayoutDashboard, Compass, Wallet, ScrollText, BarChart3, Shield, Settings, Terminal, Zap, Pause, Play, Plus, Trash2, Check, RefreshCw, X, AlertTriangle } from "lucide-react";

type Tab = "dashboard"|"discover"|"wallets"|"trades"|"analytics"|"risk"|"settings"|"logs";
const tabs:{id:Tab;label:string;icon:any}[] = [
  {id:"dashboard",label:"Dashboard",icon:LayoutDashboard},{id:"discover",label:"Discover",icon:Compass},
  {id:"wallets",label:"Wallets",icon:Wallet},{id:"trades",label:"Trade Log",icon:ScrollText},
  {id:"analytics",label:"Analytics",icon:BarChart3},{id:"risk",label:"Risk",icon:Shield},
  {id:"settings",label:"Settings",icon:Settings},{id:"logs",label:"Logs",icon:Terminal},
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [clock, setClock] = useState("");
  useEffect(() => { const u = () => setClock(new Date().toLocaleTimeString()); u(); const i = setInterval(u, 1000); return () => clearInterval(i); }, []);
  const { data: botStatus, refresh: rBot } = useAPI<any>("/api/bot?action=status", 3000);
  const running = !!botStatus?.running;
  const toggleBot = async () => { await apiPost("/api/bot", { action: running ? "stop" : "start" }); rBot(); };

  const { data: cfg } = useAPI<any>("/api/bot?action=config", 5000);
  const execMode = cfg?.executionMode || "manual";

  return (
    <div className="flex min-h-screen font-sans text-[13px]">
      <aside className="w-[220px] bg-bg-2 border-r border-edge-1 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="px-4 py-5 flex items-center gap-2.5 border-b border-edge-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-mint to-sky flex items-center justify-center"><Zap size={16} className="text-bg-1" /></div>
          <div><div className="font-bold text-sm tracking-tight">PolyCopy</div><div className="text-[10px] text-zinc-500">v3.0 — Production</div></div>
        </div>
        {/* Execution mode badge */}
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-edge-1 bg-bg-1">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Execution</div>
          <div className={cn("text-[12px] font-bold mt-0.5", execMode === "manual" ? "text-mint" : "text-coral")}>{execMode === "manual" ? "🛡 Manual Approve" : "⚡ Auto Execute"}</div>
        </div>
        {/* Telegram status */}
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg border border-edge-1 bg-bg-1">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Telegram</div>
          <div className="text-[12px] font-bold mt-0.5 text-zinc-400">
            {cfg?.enableTelegram !== false && cfg?.telegramBotToken ? "📱 Connected" : "⚫ Not set"}
          </div>
        </div>
        <nav className="py-3 flex-1 overflow-auto">
          {tabs.map(t => { const I = t.icon; const a = tab === t.id; return (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-2.5 px-4 py-2.5 mx-2 my-0.5 rounded-lg w-[calc(100%-16px)] text-left text-[13px] transition-all", a ? "bg-mint/10 text-mint font-semibold" : "text-zinc-500 hover:text-zinc-300 hover:bg-bg-4")}><I size={18} />{t.label}</button>
          ); })}
        </nav>
        <div className="p-4 border-t border-edge-1">
          <button onClick={toggleBot} className={cn("w-full py-2.5 rounded-lg font-bold text-[13px] flex items-center justify-center gap-2 transition-all", running ? "bg-coral/15 text-coral" : "bg-mint/15 text-mint")}>{running ? <><Pause size={16} />Stop Bot</> : <><Play size={16} />Start Bot</>}</button>
          {running && <div className="mt-2 flex items-center gap-1.5 justify-center"><div className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" /><span className="text-[11px] text-mint">Bot Active</span></div>}
          <UserInfo />
        </div>
      </aside>
      <main className="flex-1 p-5 overflow-auto min-w-0">
        <div className="flex justify-between items-center mb-5">
          <h1 className="text-xl font-bold tracking-tight">{tabs.find(t => t.id === tab)?.label}</h1>
          <div className="flex items-center gap-3"><Badge s={running ? "running" : "stopped"} /><span className="font-mono text-xs text-zinc-500">{clock}</span></div>
        </div>
        <div className="fade-in">
          {tab === "dashboard" && <DashboardTab running={running} />}
          {tab === "discover" && <DiscoverTab />}
          {tab === "wallets" && <WalletsTab />}
          {tab === "trades" && <TradesTab />}
          {tab === "analytics" && <AnalyticsTab />}
          {tab === "risk" && <RiskTab />}
          {tab === "settings" && <SettingsTab />}
          {tab === "logs" && <LogsTab />}
        </div>
      </main>
    </div>
  );
}

/* ═══ DASHBOARD ═══════════════════════════════════════════════ */
function DashboardTab({ running }: { running: boolean }) {
  const { data: risk } = useAPI<any>("/api/trades?action=risk", 5000);
  const { data: pnlData } = useAPI<any>("/api/trades?action=pnl&days=30");
  const { data: tradesData } = useAPI<any>("/api/trades?limit=10", 5000);
  const { data: walletsData } = useAPI<any>("/api/traders?tracked=true");
  const { data: feedData, loading: feedLoading } = useAPI<any>("/api/feed?limit=30", 10000);
  const r = risk || {}; const trades = tradesData?.trades || []; const wallets = walletsData?.traders || []; const pts = pnlData?.pnl || [];
  const feed = feedData?.trades || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Total P&L"><Pnl v={r.totalPnl || 0} sz="lg" /></Stat>
        <Stat label="Today P&L" sub={`${r.todayTrades || 0} trades today`}><Pnl v={r.dailyPnl || 0} sz="lg" /></Stat>
        <Stat label="Win Rate" sub={`PF: ${(r.profitFactor || 0).toFixed(2)}`}><span className={(r.winRate || 0) >= 0.6 ? "text-mint" : "text-coral"}>{pct(r.winRate || 0)}</span></Stat>
        <Stat label="Open Positions" sub={`${r.totalTrades || 0} total`}><span className="text-iris">{r.openPositions || 0}</span></Stat>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1.5">Daily Exposure</div><div className="text-lg font-bold font-mono">{fmt(r.dailyExposure || 0)}</div><div className="mt-2 h-1 rounded bg-edge-1 overflow-hidden"><div className="h-full rounded bg-mint transition-all" style={{ width: `${Math.min(100, (r.dailyExposure || 0) / 5000 * 100)}%` }} /></div></Card>
        <Stat label="Total Exposure">{fmt(r.totalExposure || 0)}</Stat>
        <Stat label="Tracked Wallets" sub={`${wallets.filter((w: any) => w.status === "active").length} active`}>{wallets.length}</Stat>
      </div>
      {pts.length > 1 && <Card><h3 className="text-sm font-semibold mb-3">Cumulative P&L</h3><Spark data={pts.map((p: any) => p.cumPnl)} color={pts[pts.length - 1]?.cumPnl >= 0 ? "#00d4aa" : "#ff4757"} w={700} h={120} /></Card>}

      {/* PENDING APPROVAL */}
      <PendingApprovals />

      {/* SHADOW P&L */}
      <ShadowPnlCard />

      {/* LIVE WHALE FEED */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <div><h3 className="text-sm font-semibold">🐋 Live Whale Feed</h3><p className="text-[10px] text-zinc-500 mt-0.5">Real trades from your tracked wallets</p></div>
          <Badge s={running ? "live" : "paused"} />
        </div>
        {feedLoading ? <LoadingDots /> : feed.length === 0 ? <EmptyState msg="Track wallets in Discover tab to see their live trades here" /> : (
          <div className="overflow-auto max-h-[400px] space-y-1.5">
            {feed.map((t: any, i: number) => (
              <div key={`feed-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-2/50 hover:bg-bg-4/60 border border-edge-1/30">
                <div className="flex-shrink-0 text-center">
                  <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded", t.type === "REDEEM" ? "bg-iris/15 text-iris" : t.side === "BUY" ? "bg-mint/15 text-mint" : "bg-coral/15 text-coral")}>{t.type === "REDEEM" ? "REDEEM" : t.side}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[12px] text-zinc-200 truncate">{t.market}</span>
                    <Pill color={t.outcome === "Yes" || t.outcome === "YES" ? "#00d4aa" : "#ff4757"}>{t.outcome}</Pill>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-zinc-500">by <span className="text-iris">{t.traderLabel || t.name}</span></span>
                    <span className="text-[10px] text-zinc-600">&bull;</span>
                    <span className="text-[10px] text-zinc-500">{timeAgo(t.timestamp)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-[12px] font-semibold">${t.usdcSize?.toFixed(2)}</div>
                  <div className="font-mono text-[10px] text-zinc-500">@ {t.price?.toFixed(3)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* COPY TRADE LOG */}
      <Card>
        <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-semibold">Copy Trade Log</h3><span className="text-[11px] text-zinc-500">{trades.length} trades</span></div>
        {trades.length === 0 ? <EmptyState msg="Bot will log copied trades here once it detects whale moves" /> : (
          <div className="overflow-x-auto">
            <table className="w-full"><thead><tr className="border-b border-edge-1"><TH>Time</TH><TH>Trader</TH><TH>Market</TH><TH>Side</TH><TH>Price</TH><TH>Size</TH><TH>Status</TH><TH>P&L</TH></tr></thead>
              <tbody>{trades.map((t: any, i: number) => (
                <tr key={`dash-trade-${i}`} className="border-b border-edge-1/50 hover:bg-bg-4/40" style={{ opacity: t.status === "skipped" ? 0.5 : 1 }}>
                  <TD className="font-mono text-zinc-500 text-[11px]">{timeAgo(t.timestamp)}</TD>
                  <TD><Tag>{t.traderLabel || t.sourceLabel || shortAddr(t.traderAddress || t.sourceWallet)}</Tag></TD>
                  <TD className="max-w-[200px] truncate">{t.market}</TD>
                  <TD><Pill color={t.outcome === "YES" || t.outcome === "Yes" ? "#00d4aa" : "#ff4757"}>{t.outcome || t.copySide}</Pill></TD>
                  <TD className="font-mono">{(t.originalPrice || t.copyPrice || 0).toFixed(3)}</TD>
                  <TD className="font-mono">{fmt(t.copySize || t.cost || 0)}</TD>
                  <TD><Badge s={t.status} /></TD>
                  <TD>{t.status === "executed" ? <Pnl v={t.pnl || 0} sz="sm" /> : <span className="text-zinc-500">—</span>}</TD>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ═══ DISCOVER ════════════════════════════════════════════════ */
function DiscoverTab() {
  const { data, loading, refresh } = useAPI<any>("/api/traders?orderBy=score&limit=50");
  const [discovering, setDiscovering] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const traders = data?.traders || [];
  const run = async () => { setDiscovering(true); try { await fetch("/api/traders?action=discover"); refresh(); } catch {} setDiscovering(false); };
  const track = async (a: string) => { await apiPost("/api/traders", { action: "track", address: a }); refresh(); };

  return (
    <div className="space-y-4">
      {selected ? <TraderDetail address={selected} onBack={() => setSelected(null)} /> : (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-semibold">Trader Discovery Engine</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">Live data from <span className="text-iris">Polymarket Leaderboard API</span> — real P&L, volume, and rankings</p>
            </div>
            <button onClick={run} disabled={discovering} className="px-4 py-2 bg-mint text-bg-1 rounded-lg font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50">
              <RefreshCw size={14} className={discovering ? "animate-spin" : ""} />{discovering ? "Fetching Live..." : "Refresh Leaderboard"}</button>
          </div>
          {loading ? <LoadingDots /> : traders.length === 0 ? <EmptyState msg='Click "Refresh Leaderboard" to fetch live trader rankings from Polymarket' /> : (
            <div className="overflow-x-auto">
              <table className="w-full"><thead><tr className="border-b border-edge-1"><TH>#</TH><TH>Trader</TH><TH>Score</TH><TH>Monthly P&L</TH><TH>Volume</TH><TH>ROI</TH><TH>Recent Trades</TH><TH>Markets</TH><TH>Action</TH></tr></thead>
                <tbody>{traders.map((t: any, i: number) => (
                  <tr key={`disc-${i}`} className="border-b border-edge-1/50 hover:bg-bg-4/40 cursor-pointer" onClick={() => setSelected(t.address)}>
                    <TD className="font-mono text-zinc-500">#{i + 1}</TD>
                    <TD><div className="font-semibold text-[13px]">{t.label}</div><div className="text-[10px] text-zinc-500 font-mono">{shortAddr(t.address)}</div></TD>
                    <TD><span className="font-mono font-bold text-iris">{(t.score || 0).toFixed(1)}</span></TD>
                    <TD><Pnl v={t.totalPnl || 0} sz="sm" /></TD>
                    <TD className="font-mono text-zinc-300">{t.roi ? fmt(Math.round(Math.abs(t.totalPnl || 0) / Math.abs(t.roi || 0.01))) : "—"}</TD>
                    <TD className="font-mono text-iris">{t.roi ? pct(t.roi) : "—"}</TD>
                    <TD className="font-mono">{t.totalTrades || 0}</TD>
                    <TD className="font-mono">{t.marketsTraded || 0}</TD>
                    <TD onClick={e => e.stopPropagation()}>{t.tracked ? <span className="text-zinc-500 flex items-center gap-1 text-[11px]"><Check size={12} />Tracked</span> :
                      <button onClick={() => track(t.address)} className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-mint/10 text-mint hover:bg-mint/20 flex items-center gap-1"><Plus size={12} />Track</button>}</TD>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            <p className="text-[10px] text-zinc-600">All P&L and Volume fetched live from <span className="text-iris">data-api.polymarket.com/v1/leaderboard</span></p>
            <p className="text-[10px] text-zinc-600">Click any row to see recent trades</p>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══ TRADER DETAIL ═══════════════════════════════════════════ */
function TraderDetail({ address, onBack }: { address: string; onBack: () => void }) {
  const { data: feedData, loading } = useAPI<any>(`/api/feed?address=${address}&limit=50`);
  const { data: traderData } = useAPI<any>(`/api/traders?orderBy=score&limit=200`);
  const { data: posData } = useAPI<any>(`/api/traders?action=positions&address=${address}`);
  const trades = feedData?.trades || [];
  const trader = (traderData?.traders || []).find((t: any) => t.address?.toLowerCase() === address.toLowerCase());
  const positions = posData?.positions || [];
  const posTotal = positions.reduce((s: number, p: any) => s + (p.cashPnl || 0), 0);
  const posValue = positions.reduce((s: number, p: any) => s + (p.currentValue || 0), 0);
  const track = async () => { await apiPost("/api/traders", { action: "track", address }); };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-[12px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1">&#8592; Back to Discover</button>
      <Card>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold">{trader?.label || shortAddr(address)}</h3>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{address}</p>
            <a href={`https://polymarket.com/profile/${address}`} target="_blank" rel="noreferrer" className="text-[11px] text-iris hover:underline mt-0.5 inline-block">View on Polymarket &#8599;</a>
          </div>
          {trader && !trader.tracked && <button onClick={track} className="px-4 py-2 bg-mint text-bg-1 rounded-lg font-semibold text-xs flex items-center gap-1.5"><Plus size={14} />Track This Trader</button>}
          {trader?.tracked && <span className="text-mint text-[11px] flex items-center gap-1"><Check size={14} />Tracking</span>}
        </div>
        {trader && (
          <div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-bg-2 rounded-lg"><div className="text-[10px] text-zinc-500 uppercase">Score</div><div className="text-lg font-bold text-iris">{(trader.score || 0).toFixed(1)}</div></div>
              <div className="text-center p-3 bg-bg-2 rounded-lg"><div className="text-[10px] text-zinc-500 uppercase">Monthly P&L</div><div className="text-lg font-bold"><Pnl v={trader.totalPnl || 0} /></div></div>
              <div className="text-center p-3 bg-bg-2 rounded-lg"><div className="text-[10px] text-zinc-500 uppercase">Recent Trades</div><div className="text-lg font-bold">{trader.totalTrades || 0}</div></div>
              <div className="text-center p-3 bg-bg-2 rounded-lg"><div className="text-[10px] text-zinc-500 uppercase">ROI</div><div className="text-lg font-bold text-iris">{trader.roi ? pct(trader.roi) : "—"}</div></div>
            </div>
            <p className="text-[10px] text-zinc-500">P&L from <span className="text-iris">Polymarket Leaderboard API</span> (live). Trade count from activity endpoint.</p>
          </div>
        )}
      </Card>

      {/* Live Positions */}
      {positions.length > 0 && (
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold">Open Positions ({positions.length})</h3>
            <div className="flex gap-4 text-[11px]">
              <span className="text-zinc-500">Value: <span className="font-mono text-zinc-200">{fmt(posValue)}</span></span>
              <span className="text-zinc-500">Unrealized P&L: <span className={cn("font-mono font-bold", posTotal >= 0 ? "text-mint" : "text-coral")}>{posTotal >= 0 ? "+" : ""}{fmt(posTotal)}</span></span>
            </div>
          </div>
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full"><thead><tr className="border-b border-edge-1"><TH>Market</TH><TH>Side</TH><TH>Size</TH><TH>Avg Price</TH><TH>Current</TH><TH>Value</TH><TH>P&L</TH></tr></thead>
              <tbody>{positions.slice(0, 20).map((p: any, i: number) => (
                <tr key={i} className="border-b border-edge-1/50 hover:bg-bg-4/40">
                  <TD className="max-w-[200px] truncate">{p.title}</TD>
                  <TD><Pill color={p.outcome === "Yes" ? "#00d4aa" : "#ff4757"}>{p.outcome}</Pill></TD>
                  <TD className="font-mono">{Number(p.size || 0).toFixed(1)}</TD>
                  <TD className="font-mono">{Number(p.avgPrice || 0).toFixed(3)}</TD>
                  <TD className="font-mono">{Number(p.curPrice || 0).toFixed(3)}</TD>
                  <TD className="font-mono">{fmt(p.currentValue || 0)}</TD>
                  <TD><Pnl v={p.cashPnl || 0} sz="sm" /></TD>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">Live from <span className="text-iris">data-api.polymarket.com/positions</span></p>
        </Card>
      )}

      <Card>
        <h3 className="text-sm font-semibold mb-3">Recent Activity ({trades.length})</h3>
        {loading ? <LoadingDots /> : trades.length === 0 ? <EmptyState msg="No activity found for this wallet" /> : (
          <div className="overflow-auto max-h-[500px] space-y-1">
            {trades.map((t: any, i: number) => (
              <div key={`detail-feed-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-2/50 hover:bg-bg-4/60 border border-edge-1/30">
                <div className="flex-shrink-0 w-[54px] text-center">
                  <div className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", t.type === "REDEEM" ? "bg-iris/15 text-iris" : t.side === "BUY" ? "bg-mint/15 text-mint" : "bg-coral/15 text-coral")}>{t.type === "REDEEM" ? "REDEEM" : t.side}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[12px] text-zinc-200 truncate">{t.market}</span>
                    <Pill color={t.outcome === "Yes" || t.outcome === "YES" ? "#00d4aa" : "#ff4757"}>{t.outcome}</Pill>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{new Date(t.timestamp).toLocaleString()}</div>
                </div>
                <div className="text-right flex-shrink-0 min-w-[80px]">
                  <div className="font-mono text-[12px] font-semibold">${t.usdcSize?.toFixed(2)}</div>
                  <div className="font-mono text-[10px] text-zinc-500">@ {t.price?.toFixed(3)}</div>
                </div>
                <div className="text-right flex-shrink-0 min-w-[50px]">
                  <div className="font-mono text-[10px] text-zinc-500">{t.size?.toFixed(1)} sh</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ═══ WALLETS ═════════════════════════════════════════════════ */
function WalletsTab() {
  const { data, refresh } = useAPI<any>("/api/traders?tracked=true", 5000);
  const wallets = data?.traders || [];
  const [addr, setAddr] = useState(""); const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");
  const inp = "w-full bg-bg-2 border border-edge-1 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-mint/50";
  const add = async () => {
    if (!addr || !addr.startsWith("0x") || addr.length < 10) { setAddErr("Enter a valid 0x address"); return; }
    setAdding(true); setAddErr("");
    try {
      const res = await fetch(`/api/traders?action=analyze&address=${addr}`);
      if (res.ok) {
        const d = await res.json();
        if (d.trader) {
          await apiPost("/api/traders", { action: "track", address: addr, allocation: 100 });
          setAddr(""); setLabel(""); refresh();
        }
      } else {
        const d = await res.json().catch(() => ({ error: "Unknown error" }));
        await apiPost("/api/traders", { action: "upsert", address: addr, label: label || shortAddr(addr), tracked: true, status: "active", winRate: 0, totalPnl: 0, totalTrades: 0, avgTradeSize: 0, roi: 0, score: 0, lastActive: 0, marketsTraded: 0, longestWinStreak: 0, maxDrawdown: 0, sharpeRatio: 0, copyAllocation: 100, addedAt: Date.now() });
        await apiPost("/api/traders", { action: "track", address: addr });
        setAddErr(d.error || "Added (no trade history found — will still track)");
        setAddr(""); setLabel(""); refresh();
      }
    } catch (e: any) { setAddErr(e.message); }
    setAdding(false);
  };
  const remove = async (a: string) => { await apiPost("/api/traders", { action: "untrack", address: a }); refresh(); };
  const toggle = async (a: string, s: string) => { await apiPost("/api/traders", { action: s === "active" ? "pause" : "resume", address: a }); refresh(); };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold mb-3">Add Wallet</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-[2] min-w-[200px]"><label className="text-[11px] text-zinc-500 block mb-1">Address</label><input className={inp} placeholder="0x..." value={addr} onChange={e => setAddr(e.target.value)} /></div>
          <div className="flex-1 min-w-[120px]"><label className="text-[11px] text-zinc-500 block mb-1">Label</label><input className={inp} placeholder="WhaleTrader" value={label} onChange={e => setLabel(e.target.value)} /></div>
          <button onClick={add} disabled={adding} className="px-4 py-2 bg-mint text-bg-1 rounded-lg font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50">{adding ? <><RefreshCw size={14} className="animate-spin" />Analyzing...</> : <><Plus size={14} />Add &amp; Analyze</>}</button>
        </div>
        {addErr && <p className="text-[11px] mt-2 text-amber-400">{addErr}</p>}
        <p className="text-[10px] text-zinc-600 mt-2">Paste any Polymarket wallet address. Real trade history will be fetched.</p>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold mb-4">Tracked ({wallets.length})</h3>
        {!wallets.length ? <EmptyState msg="No wallets tracked yet" /> : (
          <table className="w-full"><thead><tr className="border-b border-edge-1"><TH>Wallet</TH><TH>Status</TH><TH>Monthly P&L</TH><TH>Trades</TH><TH>ROI</TH><TH>Score</TH><TH>Actions</TH></tr></thead>
            <tbody>{wallets.map((w: any, i: number) => (
              <tr key={`wallet-${i}`} className="border-b border-edge-1/50 hover:bg-bg-4/40">
                <TD><div className="font-semibold">{w.label}</div><div className="text-[10px] text-zinc-500 font-mono">{shortAddr(w.address)}</div></TD>
                <TD><Badge s={w.status} /></TD>
                <TD><Pnl v={w.totalPnl || 0} sz="sm" /></TD>
                <TD className="font-mono">{w.totalTrades}</TD>
                <TD className="font-mono text-iris">{w.roi ? pct(w.roi) : "—"}</TD>
                <TD className="font-mono font-bold text-iris">{(w.score || 0).toFixed(1)}</TD>
                <TD><div className="flex gap-1.5">
                  <button onClick={() => toggle(w.address, w.status)} className="p-1.5 rounded-md border border-edge-1 text-zinc-500 hover:text-zinc-200">{w.status === "active" ? <Pause size={14} /> : <Play size={14} />}</button>
                  <button onClick={() => remove(w.address)} className="p-1.5 rounded-md bg-coral/10 text-coral hover:bg-coral/20"><Trash2 size={14} /></button>
                </div></TD>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ═══ TRADES ══════════════════════════════════════════════════ */
function TradesTab() {
  const [f, setF] = useState("all");
  const { data, loading } = useAPI<any>(`/api/trades?limit=200&status=${f}`, 5000);
  const trades = data?.trades || [];
  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold">Trade Log ({trades.length})</h3>
        <div className="flex gap-1">{["all", "pending_approval", "executed", "approved", "filtered", "dry_run", "rejected", "skipped", "failed"].map(x => <button key={x} onClick={() => setF(x)} className={cn("px-2.5 py-1 rounded-md text-[11px] font-medium capitalize", f === x ? "bg-mint/10 text-mint" : "text-zinc-500")}>{x === "dry_run" ? "Dry Run" : x === "pending_approval" ? "Pending" : x}</button>)}</div>
      </div>
      {loading ? <LoadingDots /> : !trades.length ? <EmptyState msg="No trades yet" /> : (
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full"><thead className="sticky top-0 bg-bg-3 z-10"><tr className="border-b border-edge-1"><TH>Time</TH><TH>Trader</TH><TH>Market</TH><TH>Side</TH><TH>Price</TH><TH>Size</TH><TH>Status</TH><TH>Reason</TH><TH>P&L</TH></tr></thead>
            <tbody>{trades.map((t: any, i: number) => (
              <tr key={`log-trade-${i}`} className="border-b border-edge-1/50 hover:bg-bg-4/40" style={{ opacity: t.status === "skipped" ? 0.5 : 1 }}>
                <TD className="font-mono text-zinc-500 text-[11px] whitespace-nowrap">{new Date(t.timestamp).toLocaleString()}</TD>
                <TD><Tag>{t.sourceLabel || shortAddr(t.sourceWallet)}</Tag></TD>
                <TD className="max-w-[180px] truncate">{t.market}</TD>
                <TD><Pill color={t.outcome === "YES" ? "#00d4aa" : "#ff4757"}>{t.outcome}</Pill></TD>
                <TD className="font-mono">{t.originalPrice?.toFixed(3)}</TD>
                <TD className="font-mono">{fmt(t.cost || 0)}</TD>
                <TD><Badge s={t.status} /></TD>
                <TD className="text-[11px] text-zinc-500 max-w-[150px] truncate">{t.skipReason || "—"}</TD>
                <TD>{t.status === "executed" ? <Pnl v={t.pnl || 0} sz="sm" /> : <span className="text-zinc-500">—</span>}</TD>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ═══ ANALYTICS ═══════════════════════════════════════════════ */
function AnalyticsTab() {
  const { data: risk } = useAPI<any>("/api/trades?action=risk");
  const { data: pnlData } = useAPI<any>("/api/trades?action=pnl&days=30");
  const { data: shadow } = useAPI<any>("/api/trades?action=shadow", 15000);
  const r = risk || {}; const pts = pnlData?.pnl || [];
  const shadowSummary = shadow?.summary || [];
  const shadowTotal = shadow?.totalPnl || 0;
  const shadowTrades = shadow?.totalTrades || 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Win Rate"><span className={(r.winRate || 0) >= 0.6 ? "text-mint" : "text-coral"}>{pct(r.winRate || 0)}</span></Stat>
        <Stat label="Profit Factor"><span className={(r.profitFactor || 0) >= 1.5 ? "text-mint" : "text-amber"}>{(r.profitFactor || 0).toFixed(2)}</span></Stat>
        <Stat label="Total P&L"><Pnl v={r.totalPnl || 0} sz="lg" /></Stat>
        <Stat label="Total Trades">{r.totalTrades || 0}</Stat>
      </div>
      {pts.length > 1 && (
        <>
          <Card><h3 className="text-sm font-semibold mb-3">Equity Curve</h3><Spark data={pts.map((p: any) => p.cumPnl)} color={pts[pts.length - 1]?.cumPnl >= 0 ? "#00d4aa" : "#ff4757"} w={700} h={140} /></Card>
          <Card><h3 className="text-sm font-semibold mb-4">Daily P&L</h3><div className="flex items-end gap-2 h-[140px] pt-4">{pts.slice(-14).map((d: any, i: number) => { const mx = Math.max(...pts.slice(-14).map((x: any) => Math.abs(x.pnl)), 1); const h = (Math.abs(d.pnl) / mx) * 90; const p = d.pnl >= 0; return <div key={i} className="flex-1 flex flex-col items-center gap-1"><div className="text-[9px] font-mono" style={{ color: p ? "#00d4aa" : "#ff4757" }}>{p ? "+" : ""}{fmt(d.pnl)}</div><div className="w-full max-w-[32px] rounded-t" style={{ height: `${Math.max(3, h)}px`, background: p ? "rgba(0,212,170,0.3)" : "rgba(255,71,87,0.3)", border: `1px solid ${p ? "#00d4aa" : "#ff4757"}` }} /><div className="text-[9px] text-zinc-500">{d.date?.slice(5)}</div></div>; })}</div></Card>
        </>
      )}

      {/* Shadow P&L Analytics */}
      {shadowTrades > 0 ? (
        <Card className="border-iris/30">
          <h3 className="text-sm font-semibold mb-1">👻 Shadow P&L Analytics</h3>
          <p className="text-[10px] text-zinc-500 mb-4">Simulated returns if you&apos;d copied every non-filtered whale trade at detection time.</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-bg-2 rounded-lg">
              <div className="text-[10px] text-zinc-500 uppercase">Shadow Total</div>
              <div className="text-xl font-bold mt-0.5"><Pnl v={shadowTotal} /></div>
            </div>
            <div className="text-center p-3 bg-bg-2 rounded-lg">
              <div className="text-[10px] text-zinc-500 uppercase">Shadow Trades</div>
              <div className="text-xl font-bold mt-0.5">{shadowTrades}</div>
            </div>
            <div className="text-center p-3 bg-bg-2 rounded-lg">
              <div className="text-[10px] text-zinc-500 uppercase">Avg P&L / Trade</div>
              <div className="text-xl font-bold mt-0.5"><Pnl v={shadowTrades > 0 ? shadowTotal / shadowTrades : 0} /></div>
            </div>
          </div>

          {/* Per-trader bar chart (visual) */}
          {shadowSummary.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-zinc-400">Per-Trader Shadow Returns</h4>
              {shadowSummary.slice(0, 15).map((t: any, i: number) => {
                const maxAbs = Math.max(...shadowSummary.slice(0, 15).map((x: any) => Math.abs(x.shadowPnl)), 1);
                const barW = Math.min(100, (Math.abs(t.shadowPnl) / maxAbs) * 100);
                const positive = t.shadowPnl >= 0;
                return (
                  <div key={`sbar-${i}`} className="flex items-center gap-3">
                    <div className="w-[100px] text-[11px] font-semibold text-zinc-300 truncate">{t.label}</div>
                    <div className="flex-1 h-5 bg-bg-2 rounded overflow-hidden relative">
                      <div className={cn("h-full rounded transition-all", positive ? "bg-mint/30" : "bg-coral/30")} style={{ width: `${Math.max(2, barW)}%` }} />
                      <span className={cn("absolute right-2 top-0.5 text-[10px] font-mono font-bold", positive ? "text-mint" : "text-coral")}>
                        {positive ? "+" : ""}{fmt(t.shadowPnl)}
                      </span>
                    </div>
                    <div className="w-[60px] text-[10px] text-zinc-500 text-right">{t.trades} trades</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : (
        <Card className="border-iris/20">
          <h3 className="text-sm font-semibold">👻 Shadow P&L Analytics</h3>
          <p className="text-[11px] text-zinc-500 mt-2">Shadow tracking active. Data will appear here once whale trades are detected and prices update (~60s). Make sure the bot is running.</p>
        </Card>
      )}
    </div>
  );
}

/* ═══ RISK ════════════════════════════════════════════════════ */
function RiskTab() {
  const { data: risk } = useAPI<any>("/api/trades?action=risk", 5000);
  const { data: cfg } = useAPI<any>("/api/bot?action=config");
  const r = risk || {}; const c = cfg || {}; const expPct = c.maxDailyExposure ? (r.dailyExposure || 0) / c.maxDailyExposure * 100 : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className={expPct > 80 ? "border-coral/50" : ""}>
          <div className="flex items-center gap-2 mb-2">{expPct > 80 && <AlertTriangle size={14} className="text-coral" />}<span className="text-[11px] text-zinc-500 uppercase tracking-wider">Daily Exposure</span></div>
          <div className="text-2xl font-bold font-mono">{fmt(r.dailyExposure || 0)}</div>
          <div className="mt-2 h-2 rounded bg-edge-1 overflow-hidden"><div className={cn("h-full rounded transition-all", expPct > 80 ? "bg-coral" : "bg-mint")} style={{ width: `${Math.min(100, expPct)}%` }} /></div>
          <div className="text-[10px] text-zinc-500 mt-1">Limit: {fmt(c.maxDailyExposure || 5000)} ({expPct.toFixed(0)}%)</div>
        </Card>
        <Stat label="Total Exposure">{fmt(r.totalExposure || 0)}</Stat>
        <Stat label="Open Positions" sub={`Max ${c.maxMarkets || 10} markets`}><span className="text-iris">{r.openPositions || 0}</span></Stat>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Win Rate"><span className={(r.winRate || 0) >= 0.6 ? "text-mint" : "text-coral"}>{pct(r.winRate || 0)}</span></Stat>
        <Stat label="Profit Factor">{(r.profitFactor || 0).toFixed(2)}</Stat>
        <Stat label="Today P&L"><Pnl v={r.dailyPnl || 0} /></Stat>
        <Stat label="Total P&L"><Pnl v={r.totalPnl || 0} /></Stat>
      </div>
      <Card><h3 className="text-sm font-semibold mb-3">Configured Limits</h3><div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs">
        {[["Max Position", fmt(c.maxPositionSize || 500)], ["Max Daily", fmt(c.maxDailyExposure || 5000)], ["Min Win Rate", pct(c.minWinRate || 0.55)], ["Copy %", `${c.copyPercentage || 50}%`], ["Slippage", `${c.slippageTolerance || 3}%`], ["Max Markets", c.maxMarkets || 10], ["Trailing Stop", c.trailingStop ? `On (${c.trailingStopPct}%)` : "Off"], ["Risk Level", c.riskLevel || "medium"]].map(([l, v]) =>
          <div key={"cfg-"+String(l)} className="flex justify-between py-2 border-b border-edge-1"><span className="text-zinc-500">{l}</span><span className="font-mono capitalize">{String(v)}</span></div>
        )}</div></Card>
    </div>
  );
}

/* ═══ SETTINGS ═══════════════════════════════════════════════ */
function SettingsTab() {
  const { data: cfg, refresh } = useAPI<any>("/api/bot?action=config");
  const c = cfg || {};
  const save = async (k: string, v: any) => { await apiPost("/api/bot", { action: "config", key: k, value: typeof v === "object" ? JSON.stringify(v) : v }); refresh(); };
  const inp = "bg-bg-2 border border-edge-1 rounded-lg px-3 py-1.5 text-sm text-right text-zinc-100 outline-none focus:border-mint/50";
  const Row = ({ l, d, children }: { l: string; d?: string; children: React.ReactNode }) => <div className="flex justify-between items-center py-3.5 border-b border-edge-1"><div><div className="font-semibold text-[13px]">{l}</div>{d && <div className="text-[11px] text-zinc-500 mt-0.5">{d}</div>}</div><div className="min-w-[200px] flex justify-end">{children}</div></div>;
  const mode = c.executionMode || "manual";
  return (
    <div className="space-y-4">
      {/* EXECUTION MODE — most important setting */}
      <Card className={mode === "auto" ? "border-coral/40" : "border-mint/40"}>
        <h3 className="text-sm font-semibold mb-2">Execution Mode</h3>
        <Row l="Trade Execution" d={mode === "manual" ? "You approve each trade before it executes" : "Bot copies trades automatically — use with caution"}>
          <div className="flex gap-2">
            <button onClick={() => save("executionMode", "manual")} className={cn("px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all", mode === "manual" ? "bg-mint/15 text-mint border border-mint/30" : "text-zinc-500 border border-edge-1 hover:text-zinc-300")}>Manual</button>
            <button onClick={() => save("executionMode", "auto")} className={cn("px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all", mode === "auto" ? "bg-coral/15 text-coral border border-coral/30" : "text-zinc-500 border border-edge-1 hover:text-zinc-300")}>Auto</button>
          </div>
        </Row>
        {mode === "manual" && <p className="text-[10px] text-mint mt-2">Recommended. Whale trades appear on Dashboard for you to approve or reject.</p>}
        {mode === "auto" && <p className="text-[10px] text-coral mt-2">Bot will execute trades immediately without your approval. Make sure risk limits are set correctly.</p>}
      </Card>
      <Card><h3 className="text-sm font-semibold mb-2">Risk Management</h3>
        <Row l="Max Position Size" d="Max $ per trade"><div className="flex items-center gap-2"><input className={cn(inp, "w-[100px]")} type="number" defaultValue={c.maxPositionSize || 500} onBlur={e => save("maxPositionSize", e.target.value)} /><span className="text-xs text-zinc-500">USD</span></div></Row>
        <Row l="Max Daily Exposure"><div className="flex items-center gap-2"><input className={cn(inp, "w-[100px]")} type="number" defaultValue={c.maxDailyExposure || 5000} onBlur={e => save("maxDailyExposure", e.target.value)} /><span className="text-xs text-zinc-500">USD</span></div></Row>
        <Row l="Copy %"><input className={cn(inp, "w-[80px]")} type="number" defaultValue={c.copyPercentage || 50} onBlur={e => save("copyPercentage", e.target.value)} /></Row>
        <Row l="Slippage Tolerance"><input className={cn(inp, "w-[80px]")} type="number" step="0.5" defaultValue={c.slippageTolerance || 3} onBlur={e => save("slippageTolerance", e.target.value)} /></Row>
        <Row l="Max Markets"><input className={cn(inp, "w-[80px]")} type="number" defaultValue={c.maxMarkets || 10} onBlur={e => save("maxMarkets", e.target.value)} /></Row>
        <Row l="Min Liquidity"><div className="flex items-center gap-2"><input className={cn(inp, "w-[100px]")} type="number" defaultValue={c.minLiquidity || 50000} onBlur={e => save("minLiquidity", e.target.value)} /><span className="text-xs text-zinc-500">USD</span></div></Row>
      </Card>
      <Card><h3 className="text-sm font-semibold mb-2">Execution</h3>
        <Row l="Copy Delay (sec)"><input className={cn(inp, "w-[80px]")} type="number" defaultValue={c.copyDelay || 2} onBlur={e => save("copyDelay", e.target.value)} /></Row>
        <Row l="Stale Timeout (sec)"><input className={cn(inp, "w-[80px]")} type="number" defaultValue={c.staleCopyTimeout || 30} onBlur={e => save("staleCopyTimeout", e.target.value)} /></Row>
        <Row l="Risk Level"><select className="bg-bg-2 border border-edge-1 rounded-lg px-3 py-1.5 text-sm text-zinc-100" defaultValue={c.riskLevel || "medium"} onChange={e => save("riskLevel", e.target.value)}><option value="conservative">Conservative</option><option value="medium">Medium</option><option value="aggressive">Aggressive</option></select></Row>
      </Card>
      {/* ── SMART FILTERS ── */}
      <Card className="border-iris/30">
        <h3 className="text-sm font-semibold mb-1">Smart Trade Filters</h3>
        <p className="text-[10px] text-zinc-500 mb-3">Automatically skip noise trades. Filtered trades still appear in Trade Log with reason.</p>
        <Row l="Min Trade Size" d="Skip whale trades below this $ amount"><div className="flex items-center gap-2"><input className={cn(inp, "w-[100px]")} type="number" defaultValue={c.minTradeSize || 50} onBlur={e => save("minTradeSize", e.target.value)} /><span className="text-xs text-zinc-500">USD</span></div></Row>
        <Row l="Exclude Categories" d='Comma-separated: "sports,culture"'><input className={cn(inp, "w-[200px]", "text-left")} type="text" defaultValue={c.excludeCategories || ""} placeholder="sports,culture" onBlur={e => save("excludeCategories", e.target.value)} /></Row>
        <Row l="Only Side" d="Only copy BUY, SELL, or both"><select className="bg-bg-2 border border-edge-1 rounded-lg px-3 py-1.5 text-sm text-zinc-100" defaultValue={c.onlySide || "both"} onChange={e => save("onlySide", e.target.value)}><option value="both">Both</option><option value="buy">BUY only</option><option value="sell">SELL only</option></select></Row>
        <Row l="Skip Low Price" d="Skip extreme longshots below this"><input className={cn(inp, "w-[80px]")} type="number" step="0.01" defaultValue={c.skipLowPrice || 0.03} onBlur={e => save("skipLowPrice", e.target.value)} /></Row>
        <Row l="Skip High Price" d="Skip near-certainties above this"><input className={cn(inp, "w-[80px]")} type="number" step="0.01" defaultValue={c.skipHighPrice || 0.97} onBlur={e => save("skipHighPrice", e.target.value)} /></Row>
        <Row l="Max Trade Age" d="Ignore trades detected too late (seconds)"><input className={cn(inp, "w-[80px]")} type="number" defaultValue={c.maxTradeAge || 120} onBlur={e => save("maxTradeAge", e.target.value)} /></Row>
      </Card>
      {/* ── CONVICTION DETECTION ── */}
      <Card className="border-amber-500/30">
        <h3 className="text-sm font-semibold mb-1">Conviction Detection</h3>
        <p className="text-[10px] text-zinc-500 mb-3">When a whale buys the same market multiple times in a window, boost copy size. Marked with 🔥 in pending trades.</p>
        <Row l="Min Repeat Buys" d="How many buys = conviction"><input className={cn(inp, "w-[80px]")} type="number" defaultValue={c.convictionMinRepeats || 2} onBlur={e => save("convictionMinRepeats", e.target.value)} /></Row>
        <Row l="Time Window" d="Look back period for repeat detection"><div className="flex items-center gap-2"><input className={cn(inp, "w-[80px]")} type="number" defaultValue={c.convictionWindow || 3600} onBlur={e => save("convictionWindow", e.target.value)} /><span className="text-xs text-zinc-500">sec</span></div></Row>
        <Row l="Copy Boost" d="Multiply copy % when convicted"><div className="flex items-center gap-2"><input className={cn(inp, "w-[80px]")} type="number" step="0.1" defaultValue={c.convictionMultiplier || 1.5} onBlur={e => save("convictionMultiplier", e.target.value)} /><span className="text-xs text-zinc-500">x</span></div></Row>
      </Card>
      {/* ── TELEGRAM ── */}
      <Card className="border-sky-500/30">
        <h3 className="text-sm font-semibold mb-1">📱 Telegram Alerts</h3>
        <p className="text-[10px] text-zinc-500 mb-3">Get whale trade alerts on your phone with Approve/Reject buttons.</p>
        <div className="bg-bg-1 rounded-lg p-4 space-y-3 text-[12px]">
          <div><span className="text-zinc-400 font-semibold">Setup (2 min):</span></div>
          <div className="text-zinc-400">
            <span className="text-iris font-mono">1.</span> Open Telegram, message <span className="text-mint font-mono">@BotFather</span>
          </div>
          <div className="text-zinc-400">
            <span className="text-iris font-mono">2.</span> Send <span className="font-mono text-zinc-300">/newbot</span>, follow prompts, copy the <span className="text-amber-400">bot token</span>
          </div>
          <div className="text-zinc-400">
            <span className="text-iris font-mono">3.</span> Message your new bot, then visit <span className="font-mono text-zinc-300">api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</span> to find your <span className="text-amber-400">chat ID</span>
          </div>
          <div className="text-zinc-400">
            <span className="text-iris font-mono">4.</span> Add to <span className="font-mono text-zinc-300">.env.local</span>:
          </div>
          <div className="bg-bg-2 rounded-md p-3 font-mono text-[11px] text-zinc-300">
            TELEGRAM_BOT_TOKEN=123456:ABC-DEF...<br/>
            TELEGRAM_CHAT_ID=987654321
          </div>
          <div className="text-zinc-400">
            <span className="text-iris font-mono">5.</span> Restart the bot — you&apos;ll get a &quot;Bot started&quot; message in Telegram
          </div>
          <div className="mt-3 pt-3 border-t border-edge-1 text-zinc-500 text-[11px]">
            <span className="font-semibold text-zinc-400">What you get:</span> Instant alert for every whale trade with ✅ Approve / ❌ Reject inline buttons. Large filtered trades ($500+) also notify you.
          </div>
          <TelegramTest />
        </div>
      </Card>
    </div>
  );
}

/* ═══ USER INFO (sidebar) ═════════════════════════════════════ */
function UserInfo() {
  const { data: session } = useSession();
  const user = session?.user as any;
  if (!user) return null;
  const plan = user.plan || "free";
  const planColors: Record<string, string> = { free: "text-zinc-400", pro: "text-mint", enterprise: "text-iris" };

  return (
    <div className="mt-3 pt-3 border-t border-edge-1">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-zinc-300 truncate">{user.name || user.email}</div>
          <div className={cn("text-[10px] font-bold uppercase", planColors[plan] || "text-zinc-400")}>{plan} plan</div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-coral hover:bg-coral/10 transition-colors">Logout</button>
      </div>
      {plan === "free" && (
        <button onClick={async () => {
          const res = await apiPost("/api/stripe", { action: "checkout", plan: "pro" });
          if (res?.url) window.location.href = res.url;
        }} className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-[#00d4aa]/20 to-[#7c5cfc]/20 text-iris hover:opacity-80 border border-iris/20">
          ⬆ Upgrade to Pro — $79/mo
        </button>
      )}
    </div>
  );
}

/* ═══ SHADOW P&L ═════════════════════════════════════════════ */
function ShadowPnlCard() {
  const { data, loading } = useAPI<any>("/api/trades?action=shadow", 10000);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading || !data) return null;

  const summary = data?.summary || [];
  const totalPnl = data?.totalPnl || 0;
  const totalTrades = data?.totalTrades || 0;
  const lastUpdate = data?.lastUpdate || 0;

  if (totalTrades === 0) return (
    <Card className="border-iris/20">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">👻 Shadow P&L</h3>
        <span className="text-[10px] text-zinc-500">Waiting for whale trades...</span>
      </div>
      <p className="text-[11px] text-zinc-500 mt-2">The bot will start tracking shadow positions as your tracked wallets make trades. Make sure the bot is running and you have wallets tracked in Discover.</p>
    </Card>
  );

  const bestTrader = summary[0];
  const worstTrader = summary.length > 1 ? summary[summary.length - 1] : null;
  const profitable = summary.filter((t: any) => t.shadowPnl > 0).length;

  return (
    <Card className="border-iris/30">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">👻 Shadow P&L <span className="text-[10px] font-normal text-zinc-500">— &quot;what if you&apos;d copied?&quot;</span></h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Tracks every whale trade. Shows returns if you&apos;d copied at detection time.</p>
        </div>
        {lastUpdate > 0 && <span className="text-[10px] text-zinc-600">Prices updated {timeAgo(lastUpdate)}</span>}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center p-3 bg-bg-2 rounded-lg">
          <div className="text-[10px] text-zinc-500 uppercase">Total Shadow P&L</div>
          <div className="text-lg font-bold mt-0.5"><Pnl v={totalPnl} /></div>
        </div>
        <div className="text-center p-3 bg-bg-2 rounded-lg">
          <div className="text-[10px] text-zinc-500 uppercase">Tracked Trades</div>
          <div className="text-lg font-bold mt-0.5">{totalTrades}</div>
        </div>
        <div className="text-center p-3 bg-bg-2 rounded-lg">
          <div className="text-[10px] text-zinc-500 uppercase">Profitable Traders</div>
          <div className="text-lg font-bold mt-0.5 text-mint">{profitable}<span className="text-zinc-500 text-[13px]">/{summary.length}</span></div>
        </div>
        <div className="text-center p-3 bg-bg-2 rounded-lg">
          <div className="text-[10px] text-zinc-500 uppercase">Best Trader</div>
          <div className="text-[13px] font-bold mt-0.5 text-iris truncate">{bestTrader?.label || "—"}</div>
        </div>
      </div>

      {/* Per-trader breakdown */}
      <div className="overflow-auto max-h-[350px]">
        <table className="w-full">
          <thead><tr className="border-b border-edge-1"><TH>Trader</TH><TH>Shadow P&L</TH><TH>Trades</TH><TH>W/L</TH><TH>Win Rate</TH><TH>Open Value</TH><TH>Verdict</TH></tr></thead>
          <tbody>
            {summary.map((t: any, i: number) => (
              <tr key={`shadow-${i}`} className="border-b border-edge-1/50 hover:bg-bg-4/40 cursor-pointer" onClick={() => setExpanded(expanded === t.address ? null : t.address)}>
                <TD>
                  <div className="font-semibold text-[12px]">{t.label}</div>
                  <div className="text-[10px] text-zinc-600 font-mono">{t.address?.slice(0, 6)}…{t.address?.slice(-4)}</div>
                </TD>
                <TD><Pnl v={t.shadowPnl || 0} sz="sm" /></TD>
                <TD className="font-mono">{t.trades}</TD>
                <TD className="font-mono"><span className="text-mint">{t.wins}</span><span className="text-zinc-600">/</span><span className="text-coral">{t.losses}</span></TD>
                <TD className={cn("font-mono font-bold", (t.winRate || 0) >= 0.5 ? "text-mint" : "text-coral")}>{pct(t.winRate || 0)}</TD>
                <TD className="font-mono text-zinc-300">{fmt(t.openValue || 0)}</TD>
                <TD>
                  {t.shadowPnl > 100 ? <span className="text-[10px] px-2 py-0.5 rounded bg-mint/15 text-mint font-bold">COPY ✓</span> :
                   t.shadowPnl > 0 ? <span className="text-[10px] px-2 py-0.5 rounded bg-mint/10 text-mint/70 font-bold">Promising</span> :
                   t.shadowPnl > -50 ? <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-500 font-bold">Neutral</span> :
                   <span className="text-[10px] px-2 py-0.5 rounded bg-coral/15 text-coral font-bold">Avoid ✗</span>}
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expanded && <ShadowPositions address={expanded} />}

      <p className="text-[10px] text-zinc-600 mt-3">Shadow P&L uses CLOB midpoint prices, updated every 60s. This is simulated — no real money at risk.</p>
    </Card>
  );
}

/* ═══ SHADOW POSITIONS (expanded per-trader) ═════════════════ */
function ShadowPositions({ address }: { address: string }) {
  const { data, loading } = useAPI<any>(`/api/trades?action=shadow_positions&address=${address}`);
  const positions = data?.positions || [];

  if (loading) return <div className="mt-3"><LoadingDots /></div>;
  if (positions.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-edge-1">
      <h4 className="text-[11px] font-semibold text-zinc-400 mb-2">Shadow Positions ({positions.length})</h4>
      <div className="overflow-auto max-h-[250px] space-y-1">
        {positions.slice(0, 30).map((p: any, i: number) => (
          <div key={"sp-"+i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-2/50 border border-edge-1/20">
            <div className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded w-[40px] text-center", p.side === "BUY" ? "bg-mint/15 text-mint" : "bg-coral/15 text-coral")}>{p.side}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-zinc-300 truncate">{p.market}</div>
              <div className="text-[10px] text-zinc-500">{p.outcome} · Entry {p.entryPrice?.toFixed(3)} → Now {p.currentPrice?.toFixed(3)}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono text-[11px]"><Pnl v={p.shadowPnl || 0} sz="sm" /></div>
              <div className="text-[10px] text-zinc-600">{p.shares?.toFixed(1)} shares</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ TELEGRAM TEST ═══════════════════════════════════════════ */
function TelegramTest() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  const test = async () => {
    setStatus("sending");
    setMsg("");
    try {
      const res = await apiPost("/api/bot", { action: "telegram_test" });
      if (res?.ok) { setStatus("ok"); setMsg(res.message || "Sent! Check Telegram."); }
      else { setStatus("error"); setMsg(res?.error || "Failed — check bot logs"); }
    } catch (e: any) { setStatus("error"); setMsg(e.message || "Request failed"); }
    setTimeout(() => setStatus("idle"), 5000);
  };

  return (
    <div className="mt-3 pt-3 border-t border-edge-1 flex items-center justify-between">
      <button onClick={test} disabled={status === "sending"} className="px-4 py-2 rounded-lg text-[12px] font-bold bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border border-sky-500/30 disabled:opacity-50 flex items-center gap-1.5">
        {status === "sending" ? <><RefreshCw size={12} className="animate-spin" />Sending...</> : "📱 Send Test Alert"}
      </button>
      {msg && <span className={cn("text-[11px] font-medium", status === "ok" ? "text-mint" : "text-coral")}>{msg}</span>}
    </div>
  );
}

/* ═══ PENDING APPROVALS (Manual mode) ═════════════════════════ */
function PendingApprovals() {
  const { data, loading, refresh } = useAPI<any>("/api/trades?action=pending", 3000);
  const pending = data?.trades || [];
  const [acting, setActing] = useState<string | null>(null);

  const act = async (id: string, action: "approve" | "reject") => {
    setActing(id);
    try {
      await apiPost("/api/trades", { action, tradeId: id });
      refresh();
    } catch {}
    setActing(null);
  };

  if (!pending.length) return null;

  return (
    <Card className="border-amber-500/30">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400" />
          <h3 className="text-sm font-semibold">Pending Approval ({pending.length})</h3>
        </div>
        <span className="text-[10px] text-zinc-500">Manual mode — approve or reject each trade</span>
      </div>
      <div className="space-y-2">
        {pending.map((t: any, i: number) => (
          <div key={`pending-${i}`} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <div className="flex-shrink-0 text-center">
              <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded", (t.copySide || t.originalSide) === "BUY" ? "bg-mint/15 text-mint" : "bg-coral/15 text-coral")}>{t.copySide || t.originalSide}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[12px] text-zinc-200 truncate">{t.market}</span>
                <Pill color={t.outcome === "Yes" || t.outcome === "YES" ? "#00d4aa" : "#ff4757"}>{t.outcome}</Pill>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] text-zinc-500">from <span className="text-iris">{t.traderLabel || t.source_label || "unknown"}</span></span>
                {t.conviction > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">🔥 x{t.conviction}</span>}
                <span className="text-[10px] text-zinc-600">&bull;</span>
                <span className="text-[10px] text-zinc-500">{timeAgo(t.detectedAt || t.timestamp)}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 mr-2">
              <div className="font-mono text-[13px] font-semibold">${(t.copySize || t.originalSize || 0).toFixed(2)}</div>
              <div className="font-mono text-[10px] text-zinc-500">@ {(t.originalPrice || t.copyPrice || 0).toFixed(3)}</div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => act(t.id, "approve")} disabled={acting === t.id} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-mint/15 text-mint hover:bg-mint/25 border border-mint/30 flex items-center gap-1 disabled:opacity-50">
                <Check size={12} />Approve
              </button>
              <button onClick={() => act(t.id, "reject")} disabled={acting === t.id} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-coral/15 text-coral hover:bg-coral/25 border border-coral/30 flex items-center gap-1 disabled:opacity-50">
                <X size={12} />Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ═══ LOGS ════════════════════════════════════════════════════ */
function LogsTab() {
  const { data, loading, refresh } = useAPI<any>("/api/bot?action=logs&limit=200", 3000);
  const logs = data?.logs || [];
  const lc: Record<string, string> = { info: "text-zinc-400", warn: "text-amber", error: "text-coral", trade: "text-mint" };
  return (
    <Card>
      <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-semibold">Bot Logs</h3><button onClick={refresh} className="text-zinc-500 hover:text-zinc-300"><RefreshCw size={14} /></button></div>
      {loading ? <LoadingDots /> : !logs.length ? <EmptyState msg="No logs yet" /> : (
        <div className="max-h-[600px] overflow-auto font-mono text-[11px] bg-bg-1 rounded-lg p-4 space-y-0.5">
          {logs.map((l: any, i: number) => (
            <div key={`log-${i}`} className="flex gap-3">
              <span className="text-zinc-600 shrink-0">{new Date(l.timestamp).toLocaleTimeString()}</span>
              <span className={cn("uppercase w-[50px] shrink-0 font-semibold", lc[l.level] || "text-zinc-500")}>{l.level}</span>
              <span className="text-zinc-300">{l.message}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
