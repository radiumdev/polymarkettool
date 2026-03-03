import { NextRequest, NextResponse } from "next/server";
import { getCopyTrades, getDailyPnl, getRiskSnapshot, getShadowSummary, getShadowPositions, updateCopyTrade } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams;
  try {
    if (p.get("action") === "pnl") return NextResponse.json({ pnl: await getDailyPnl(Number(p.get("days") || 30), uid) });
    if (p.get("action") === "risk") return NextResponse.json(await getRiskSnapshot(uid));
    if (p.get("action") === "pending") { const pending = await getCopyTrades({ status: "pending_approval", limit: 50 }, uid); return NextResponse.json({ trades: pending, count: pending.length }); }
    if (p.get("action") === "shadow") { const data = await getShadowSummary(uid); return NextResponse.json({ ...data, lastUpdate: Date.now() }); }
    if (p.get("action") === "shadow_positions") { const positions = await getShadowPositions(uid, p.get("address") || ""); return NextResponse.json({ positions, count: positions.length }); }
    return NextResponse.json({ trades: await getCopyTrades({ limit: Number(p.get("limit") || 100), status: p.get("status") || undefined, wallet: p.get("wallet") || undefined }, uid) });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === "approve" || body.action === "reject") {
      const status = body.action === "approve" ? "approved" : "rejected";
      const data: any = { status };
      if (body.action === "approve") data.approvedAt = Date.now();
      else data.skipReason = body.reason || "Manually rejected";
      await updateCopyTrade(body.tradeId, data);
      return NextResponse.json({ ok: true, status });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
