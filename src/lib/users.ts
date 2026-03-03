import prisma from "./prisma";
import bcrypt from "bcryptjs";

export async function createUser(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return null;
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({ data: { email, name, passwordHash } });
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

export async function getUserById(id: string) { return prisma.user.findUnique({ where: { id } }); }
export async function getUserByEmail(email: string) { return prisma.user.findUnique({ where: { email } }); }

export async function upgradePlan(userId: string, plan: string, stripeSubId?: string) {
  const maxWallets = plan === "enterprise" ? 100 : plan === "pro" ? 20 : 2;
  return prisma.user.update({ where: { id: userId }, data: { plan, maxWallets, stripeSubId } });
}
