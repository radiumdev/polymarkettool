import { NextRequest, NextResponse } from "next/server";
import { getTraders } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const DATA_API = "https://data-api.polymarket.com";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = Number(new URL(req.url).searchParams.get("limit") || 30);
  try {
    const tracked = await getTraders({ tracked: true }, uid);
    if (!tracked.length) return NextResponse.json({ trades: [] });

    const labelMap = new Map<string, string>();
    tracked.forEach((t: any) => labelMap.set(t.address.toLowerCase(), t.label || t.address.slice(0, 8)));

    const allTrades: any[] = [];
    await Promise.all(tracked.map(async (t: any) => {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${DATA_API}/activity?user=${t.address}&limit=${limit}`, {
          headers: { Accept: "application/json" },
          signal: ctrl.signal,
        });
        clearTimeout(to);
        if (!res.ok) return;
        const data = await res.json();
        const history = Array.isArray(data) ? data : (data?.history || []);
        for (const trade of history) {
          allTrades.push({
            id: trade.id || trade.transactionHash || Math.random().toString(36).slice(2),
            timestamp: trade.timestamp ? trade.timestamp * 1000 : Date.now(),
            traderAddress: t.address,
            traderLabel: labelMap.get(t.address.toLowerCase()) || t.address.slice(0, 8),
            market: trade.title || "Unknown",
            side: trade.side || "BUY",
            outcome: trade.outcome || "Yes",
            price: Number(trade.price || 0),
            size: Number(trade.usdcSize || trade.size || trade.amount || 0),
            conditionId: trade.conditionId || "",
          });
        }
      } catch {}
    }));

    allTrades.sort((a, b) => b.timestamp - a.timestamp);
    return NextResponse.json({ trades: allTrades.slice(0, limit) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
