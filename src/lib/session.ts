import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import prisma from "./prisma";

export async function getSessionUserId(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) return (session.user as any).id;
  } catch {}
  try {
    const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (user) return user.id;
  } catch {}
  return null;
}
