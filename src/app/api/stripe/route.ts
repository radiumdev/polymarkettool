import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getUserById, upgradePlan } from "@/lib/users";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === "checkout") {
      const uid = await getSessionUserId();
      if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
      if (!STRIPE_KEY) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(STRIPE_KEY);
      const user = await getUserById(uid);
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const plan = body.plan || "pro";
      const priceId = plan === "enterprise" ? process.env.STRIPE_ENTERPRISE_PRICE_ID : process.env.STRIPE_PRO_PRICE_ID;
      if (!priceId) return NextResponse.json({ error: "Price not configured" }, { status: 500 });
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/?upgraded=true`,
        cancel_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/`,
        metadata: { userId: uid, plan },
      });
      return NextResponse.json({ url: session.url });
    }
    if (body.type === "checkout.session.completed") {
      const session = body.data?.object;
      const userId = session?.metadata?.userId;
      const plan = session?.metadata?.plan || "pro";
      if (userId) {
        await upgradePlan(userId, plan, session?.subscription);
        console.log(`[Stripe] Upgraded ${userId} to ${plan}`);
      }
      return NextResponse.json({ ok: true });
    }
    if (body.type === "customer.subscription.deleted") {
      const sub = body.data?.object;
      if (sub?.id) {
        const user = await prisma.user.findFirst({ where: { stripeSubId: sub.id } });
        if (user) {
          await prisma.user.update({ where: { id: user.id }, data: { plan: "free", maxWallets: 2, stripeSubId: null } });
          console.log(`[Stripe] Downgraded ${user.email} to free`);
        }
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[Stripe]", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
