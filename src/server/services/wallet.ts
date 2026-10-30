/**
 * Wallet & ledger service. Every balance change in the system goes through
 * `applyWalletChange`, which:
 *   1. locks the wallet row (SELECT … FOR UPDATE) inside the caller's transaction,
 *   2. rejects changes that would make the balance negative,
 *   3. writes an immutable ledger row with balance before/after.
 * A database CHECK constraint backs up rule (2).
 */
import type { TransactionType } from "@/generated/prisma/enums";
import { AppError, insufficientFunds } from "../errors";
import { prisma, type Tx } from "../db";

export interface WalletChange {
  userId: string;
  amount: number;
  type: TransactionType;
  description: string;
  idempotencyKey?: string;
  packId?: string;
  cardId?: string;
  packOpeningBatchId?: string;
  mysteryBoxId?: string;
  mysteryBoxOpeningId?: string;
  listingId?: string;
  adminId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

/** Locks one or more wallets in a consistent order to avoid deadlocks. */
export async function lockWallets(tx: Tx, userIds: string[]) {
  const ids = [...new Set(userIds)].sort();
  const rows = await tx.$queryRaw<{ id: string; userId: string; balance: number }[]>`
    SELECT "id", "userId", "balance" FROM "Wallet" WHERE "userId" = ANY(${ids}::text[]) ORDER BY "userId" FOR UPDATE`;
  if (rows.length !== ids.length) throw new AppError("NOT_FOUND", "Wallet not found.");
  return new Map(rows.map((r) => [r.userId, r]));
}

export async function applyWalletChange(tx: Tx, change: WalletChange) {
  if (!Number.isInteger(change.amount)) throw new AppError("BAD_REQUEST", "Amounts must be whole Rip Coins.");
  const wallets = await lockWallets(tx, [change.userId]);
  const wallet = wallets.get(change.userId)!;
  const before = wallet.balance;
  const after = before + change.amount;
  if (after < 0) throw insufficientFunds(-change.amount, before);

  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: after,
      ...(change.amount > 0 ? { lifetimeEarned: { increment: BigInt(change.amount) } } : {}),
      ...(change.amount < 0 ? { lifetimeSpent: { increment: BigInt(-change.amount) } } : {}),
    },
  });
  const transaction = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      userId: change.userId,
      type: change.type,
      amount: change.amount,
      balanceBefore: before,
      balanceAfter: after,
      description: change.description,
      idempotencyKey: change.idempotencyKey,
      packId: change.packId,
      cardId: change.cardId,
      packOpeningBatchId: change.packOpeningBatchId,
      mysteryBoxId: change.mysteryBoxId,
      mysteryBoxOpeningId: change.mysteryBoxOpeningId,
      listingId: change.listingId,
      adminId: change.adminId,
      metadata: change.metadata as object | undefined,
      ...(change.createdAt ? { createdAt: change.createdAt } : {}),
    },
  });
  return { balance: after, transaction };
}

export async function getBalance(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
  return wallet?.balance ?? 0;
}

export async function getWalletSummary(userId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { balance: true, lifetimeEarned: true, lifetimeSpent: true },
  });
  // Lifetime totals are BIGINT in the database; they comfortably fit in a JS number.
  return wallet
    ? { balance: wallet.balance, lifetimeEarned: Number(wallet.lifetimeEarned), lifetimeSpent: Number(wallet.lifetimeSpent) }
    : { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 };
}

export async function listTransactions(userId: string, opts: { cursor?: string; limit?: number } = {}) {
  const limit = Math.min(100, opts.limit ?? 25);
  const rows = await prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      type: true,
      amount: true,
      balanceBefore: true,
      balanceAfter: true,
      description: true,
      createdAt: true,
      pack: { select: { name: true, slug: true } },
      card: { select: { id: true, name: true } },
    },
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}
