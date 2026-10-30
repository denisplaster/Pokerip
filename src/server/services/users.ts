import bcrypt from "bcryptjs";
import { SIGNUP_BONUS } from "@/lib/constants";
import { AppError, conflict } from "../errors";
import { isUniqueViolation, prisma, withTransaction, type Tx } from "../db";
import { applyWalletChange } from "./wallet";

export const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

let dummyHash: Promise<string> | null = null;

export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (!hash) {
    // Spend comparable time when the user does not exist, so response timing
    // does not reveal which usernames are registered.
    dummyHash ??= bcrypt.hash("timing-equaliser", BCRYPT_ROUNDS);
    await bcrypt.compare(password, await dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}

export interface NewUserInput {
  username: string;
  email?: string | null;
  passwordHash?: string | null;
  name?: string | null;
  image?: string | null;
  avatar?: string;
  isBot?: boolean;
  createdAt?: Date;
}

/** Creates a user, their wallet and the 10,000 RC sign-up grant in one transaction. */
export async function createUserWithWallet(tx: Tx, input: NewUserInput) {
  const user = await tx.user.create({
    data: {
      username: input.username,
      email: input.email ?? null,
      passwordHash: input.passwordHash ?? null,
      name: input.name ?? input.username,
      image: input.image ?? null,
      avatar: input.avatar ?? "pikachu",
      isBot: input.isBot ?? false,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
  await tx.wallet.create({ data: { userId: user.id, balance: 0 } });
  await applyWalletChange(tx, {
    userId: user.id,
    amount: SIGNUP_BONUS,
    type: "SIGNUP_BONUS",
    description: "Welcome bonus — 10,000 Rip Coins",
    idempotencyKey: `signup:${user.id}`,
    createdAt: input.createdAt,
  });
  return user;
}

export async function registerUser(input: { username: string; email: string; password: string }) {
  const [byName, byEmail] = await Promise.all([
    prisma.user.findFirst({ where: { username: { equals: input.username, mode: "insensitive" } }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
  ]);
  if (byName) throw new AppError("CONFLICT", "That username is taken.", { field: "username" });
  if (byEmail) throw new AppError("CONFLICT", "An account with that email already exists.", { field: "email" });
  const passwordHash = await hashPassword(input.password);
  try {
    return await withTransaction((tx) =>
      createUserWithWallet(tx, { username: input.username, email: input.email, passwordHash }),
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("That username or email is already registered.");
    throw error;
  }
}

/** Looks a user up by email or username (case-insensitive) for sign-in. */
export async function findUserForLogin(identifier: string) {
  const value = identifier.trim();
  if (value.includes("@")) {
    return prisma.user.findUnique({ where: { email: value.toLowerCase() } });
  }
  return prisma.user.findFirst({ where: { username: { equals: value, mode: "insensitive" } } });
}

export async function uniqueUsername(base: string) {
  const cleaned = base.replace(/[^A-Za-z0-9_]/g, "").slice(0, 16) || "collector";
  const candidate = cleaned.length >= 3 ? cleaned : `${cleaned}_rip`;
  for (let i = 0; i < 20; i++) {
    const name = i === 0 ? candidate : `${candidate.slice(0, 15)}${Math.floor(Math.random() * 9000 + 1000)}`;
    const exists = await prisma.user.findFirst({ where: { username: { equals: name, mode: "insensitive" } }, select: { id: true } });
    if (!exists) return name;
  }
  return `collector${Date.now().toString(36)}`;
}

/**
 * Finds or creates the user linked to an OAuth account. Accounts are linked by
 * provider account id only; we never auto-link by email (prevents takeover).
 */
export async function linkOAuthAccount(input: {
  provider: string;
  providerAccountId: string;
  type: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  login?: string | null;
}) {
  const existing = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: input.provider, providerAccountId: input.providerAccountId } },
    select: { user: true },
  });
  if (existing) return existing.user;

  const username = await uniqueUsername(input.login || input.name || input.email?.split("@")[0] || "collector");
  const emailTaken = input.email
    ? await prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, select: { id: true } })
    : null;
  return withTransaction(async (tx) => {
    const user = await createUserWithWallet(tx, {
      username,
      email: input.email && !emailTaken ? input.email.toLowerCase() : null,
      name: input.name ?? username,
      image: input.image ?? null,
    });
    await tx.account.create({
      data: { userId: user.id, provider: input.provider, providerAccountId: input.providerAccountId, type: input.type },
    });
    return user;
  });
}
