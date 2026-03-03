import { NextRequest, NextResponse } from "next/server";
import { getTraders, upsertTrader, setTraderTracked, setTraderStatus } from "@/lib/db";
import { discoverTraders, analyzeAddress } from "@/lib/polymarket";
import { getSessionUserId } from "@/lib/session";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams;
  try {
    if (p.get("action") === "discover") {
      const existing = await getTraders({ limit: 500 }, uid);
      const trackedMap = new Map<string, boolean>();
      for (const t of existing) if (t.tracked) trackedMap.set(t.address.toLowerCase(), true);
      const discovered = await discoverTraders({ limit: 50 });
      for (const t of discovered) { if (!t.address) continue; if (trackedMap.has(t.address.toLowerCase())) t.tracked = true; await upsertTrader(t as any, uid); }
      return NextResponse.json({ traders: await getTraders({ limit: 100, orderBy: "score" }, uid), count: discovered.length });
    }
    if (p.get("action") === "positions") {
      const addr = p.get("address") || "";
      if (!addr || !addr.startsWith("0x")) return NextResponse.json({ error: "Invalid address" }, { status: 400 });
      const { fetchPositions } = await import("@/lib/polymarket");
      return NextResponse.json({ positions: await fetchPositions(addr) });
    }
    if (p.get("action") === "analyze") {
      const addr = p.get("address") || "";
      if (!addr || !addr.startsWith("0x")) return NextResponse.json({ error: "Invalid address" }, { status: 400 });
      const profile = await analyzeAddress(addr);
      if (!profile || !profile.totalTrades) return NextResponse.json({ error: "No trade history" }, { status: 404 });
      await upsertTrader(profile as any, uid);
      return NextResponse.json({ trader: profile });
    }
    const tracked = p.get("tracked");
    return NextResponse.json({ traders: await getTraders({ tracked: tracked === "true" ? true : tracked === "false" ? false : undefined, limit: Number(p.get("limit") || 100), orderBy: p.get("orderBy") || "score" }, uid) });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === "track") { await setTraderTracked(body.address, true, body.allocation || 100, uid); return NextResponse.json({ ok: true }); }
    if (body.action === "untrack") { await setTraderTracked(body.address, false, 100, uid); return NextResponse.json({ ok: true }); }
    if (body.action === "pause") { await setTraderStatus(body.address, "paused", uid); return NextResponse.json({ ok: true }); }
    if (body.action === "resume") { await setTraderStatus(body.address, "active", uid); return NextResponse.json({ ok: true }); }
    if (body.action === "upsert") { await upsertTrader(body, uid); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
