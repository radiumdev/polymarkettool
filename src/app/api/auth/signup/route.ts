import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/users";
export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password min 6 chars" }, { status: 400 });
    const user = await createUser(email, password, name);
    if (!user) return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    return NextResponse.json({ ok: true, userId: user.id });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
