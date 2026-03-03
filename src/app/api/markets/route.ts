import { NextRequest, NextResponse } from "next/server";
import { fetchMarkets, fetchMarket, fetchOrderBook, fetchMidpoint } from "@/lib/polymarket";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams;
  try {
    if(p.get("action")==="single") return NextResponse.json({market:await fetchMarket(p.get("id")||"")});
    if(p.get("action")==="book") return NextResponse.json({book:await fetchOrderBook(p.get("tokenId")||"")});
    if(p.get("action")==="midpoint") return NextResponse.json({mid:await fetchMidpoint(p.get("tokenId")||"")});
    return NextResponse.json({markets:await fetchMarkets(Number(p.get("limit")||50), Number(p.get("offset")||0))});
  } catch(e:any) { return NextResponse.json({error:e.message},{status:500}); }
}
