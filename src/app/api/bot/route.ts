import { NextRequest, NextResponse } from "next/server";
import { getBotStatus, updateBotStatus, getConfig, setConfigValue, getLogs, addLog } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const a = new URL(req.url).searchParams.get("action");
  try {
    if (a === "status") return NextResponse.json(await getBotStatus(uid));
    if (a === "config") return NextResponse.json(await getConfig(uid));
    if (a === "logs") return NextResponse.json({ logs: await getLogs(Number(new URL(req.url).searchParams.get("limit") || 100), uid) });
    return NextResponse.json({ error: "Specify action" }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (body.action === "start") { await updateBotStatus({ running: 1, started_at: Date.now() }, uid); await addLog("info", "Bot started via dashboard", undefined, uid); return NextResponse.json({ ok: true }); }
    if (body.action === "stop") { await updateBotStatus({ running: 0 }, uid); await addLog("info", "Bot stopped via dashboard", undefined, uid); return NextResponse.json({ ok: true }); }
    if (body.action === "config") { await setConfigValue(body.key, String(body.value), uid); return NextResponse.json({ ok: true }); }
    if (body.action === "configBulk") { for (const [k, v] of Object.entries(body.config)) await setConfigValue(k, typeof v === "object" ? JSON.stringify(v) : String(v), uid); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Unknown" }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
