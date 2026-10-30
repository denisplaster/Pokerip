import { beforeAll, describe, expect, it } from "vitest";
import { SIGNUP_BONUS } from "@/lib/constants";
import { prisma, withTransaction } from "@/server/db";
import { AppError } from "@/server/errors";
import { registerUser, verifyPassword } from "@/server/services/users";
import { applyWalletChange } from "@/server/services/wallet";
import { assertLedgerConsistent, balanceOf, createUser, seedFixture } from "./fixtures";

beforeAll(async () => {
  await seedFixture();
});

describe("accounts & wallets", () => {
  it("registers a user with a hashed password and a 10,000 RC sign-up grant", async () => {
    const user = await registerUser({ username: "AshKetch", email: "ash@test.dev", password: "pikachu123" });
    const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(full.passwordHash).not.toContain("pikachu123");
    expect(await verifyPassword("pikachu123", full.passwordHash)).toBe(true);
    expect(await verifyPassword("wrong-password1", full.passwordHash)).toBe(false);
    expect(await balanceOf(user.id)).toBe(SIGNUP_BONUS);
    const ledger = await prisma.walletTransaction.findMany({ where: { userId: user.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ type: "SIGNUP_BONUS", amount: SIGNUP_BONUS, balanceBefore: 0, balanceAfter: SIGNUP_BONUS });
  });

  it("rejects duplicate usernames (case-insensitive) and emails", async () => {
    await expect(registerUser({ username: "ashketch", email: "other@test.dev", password: "pikachu123" })).rejects.toThrow(/username is taken/);
    await expect(registerUser({ username: "Misty", email: "ash@test.dev", password: "pikachu123" })).rejects.toThrow(/email already exists/);
  });

  it("records balance before/after for every change and refuses to go negative", async () => {
    const user = await createUser({ balance: 500 });
    await withTransaction((tx) => applyWalletChange(tx, { userId: user.id, amount: -200, type: "PACK_PURCHASE", description: "t" }));
    await expect(withTransaction((tx) => applyWalletChange(tx, { userId: user.id, amount: -301, type: "PACK_PURCHASE", description: "t" }))).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
    });
    expect(await balanceOf(user.id)).toBe(300);
    const last = await prisma.walletTransaction.findFirstOrThrow({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    expect(last).toMatchObject({ amount: -200, balanceBefore: 500, balanceAfter: 300 });
    await assertLedgerConsistent(user.id);
  });

  it("serialises concurrent debits so the balance can never be overspent", async () => {
    const user = await createUser({ balance: 10_000 });
    const attempts = await Promise.allSettled(
      Array.from({ length: 25 }, () => withTransaction((tx) => applyWalletChange(tx, { userId: user.id, amount: -1_000, type: "PACK_PURCHASE", description: "race" }))),
    );
    const ok = attempts.filter((a) => a.status === "fulfilled").length;
    expect(ok).toBe(10);
    for (const a of attempts) if (a.status === "rejected") expect((a.reason as AppError).code).toBe("INSUFFICIENT_FUNDS");
    expect(await balanceOf(user.id)).toBe(0);
    await assertLedgerConsistent(user.id);
  });

  it("is protected by database constraints even if application code is bypassed", async () => {
    const user = await createUser({ balance: 100 });
    await expect(prisma.$executeRaw`UPDATE "Wallet" SET "balance" = -1 WHERE "userId" = ${user.id}`).rejects.toThrow();
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    await expect(
      prisma.walletTransaction.create({ data: { walletId: wallet.id, userId: user.id, type: "ADMIN_ADJUSTMENT", amount: 5, balanceBefore: 100, balanceAfter: 999, description: "bad math" } }),
    ).rejects.toThrow();
  });

  it("enforces idempotency keys on ledger entries", async () => {
    const user = await createUser({ balance: 1_000 });
    await withTransaction((tx) => applyWalletChange(tx, { userId: user.id, amount: -10, type: "PACK_PURCHASE", description: "once", idempotencyKey: `idem-${user.id}` }));
    await expect(
      withTransaction((tx) => applyWalletChange(tx, { userId: user.id, amount: -10, type: "PACK_PURCHASE", description: "twice", idempotencyKey: `idem-${user.id}` })),
    ).rejects.toThrow();
    expect(await balanceOf(user.id)).toBe(990);
  });
});
