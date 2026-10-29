import { beforeEach, describe, expect, it } from "vitest";
import { prisma, withTransaction } from "@/server/db";
import { openPacks, verifyOpening } from "@/server/services/packs";
import { publishPackOdds } from "@/server/services/odds";
import { assertLedgerConsistent, balanceOf, createUser, seedFixture, type Fixture } from "./fixtures";

let fx: Fixture;
beforeEach(async () => {
  fx = await seedFixture();
});

const key = () => `k${Math.random().toString(36).slice(2, 14)}`;

describe("opening packs", () => {
  it("charges the pack price server-side and adds every pulled card to the collection", async () => {
    const user = await createUser({ balance: 1_000 });
    const res = await openPacks({ userId: user.id, pack: "test-pack", quantity: 1, idempotencyKey: key() });
    expect(res.packs).toHaveLength(1);
    expect(res.packs[0].cards).toHaveLength(5);
    expect(res.totalPaid).toBe(100);
    const owned = await prisma.userCard.findMany({ where: { userId: user.id } });
    expect(owned).toHaveLength(5);
    expect(new Set(owned.map((o) => o.id))).toEqual(new Set(res.packs[0].cards.map((c) => c.userCardId)));
    // Balance: 1,000 - 100 + any progression rewards, and the ledger must reconcile.
    const ledger = await prisma.walletTransaction.findMany({ where: { userId: user.id, type: "PACK_PURCHASE" } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(-100);
    expect(res.balance).toBe(await assertLedgerConsistent(user.id));
    const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(u.packsOpened).toBe(1);
  });

  it("stores auditable rolls that replay to the same cards", async () => {
    const user = await createUser({ balance: 5_000 });
    const res = await openPacks({ userId: user.id, pack: "test-pack", quantity: 10, idempotencyKey: key() });
    expect(res.packs).toHaveLength(10);
    for (const p of res.packs) {
      const audit = await verifyOpening(p.openingId);
      expect(audit.valid).toBe(true);
      expect(audit.checks).toHaveLength(5);
    }
  });

  it("is idempotent: retrying with the same key never charges twice", async () => {
    const user = await createUser({ balance: 1_000 });
    const k = key();
    const first = await openPacks({ userId: user.id, pack: "test-pack", quantity: 5, idempotencyKey: k });
    const second = await openPacks({ userId: user.id, pack: "test-pack", quantity: 5, idempotencyKey: k });
    expect(second.replayed).toBe(true);
    expect(second.batchId).toBe(first.batchId);
    expect(second.packs.map((p) => p.cards.map((c) => c.card.id))).toEqual(first.packs.map((p) => p.cards.map((c) => c.card.id)));
    expect(await prisma.packOpening.count({ where: { userId: user.id } })).toBe(5);
    expect(await prisma.walletTransaction.count({ where: { userId: user.id, type: "PACK_PURCHASE" } })).toBe(1);
  });

  it("handles concurrent duplicate requests (double-click) as a single purchase", async () => {
    const user = await createUser({ balance: 1_000 });
    const k = key();
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => openPacks({ userId: user.id, pack: "test-pack", quantity: 1, idempotencyKey: k })));
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThan(0);
    expect(await prisma.packOpening.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.walletTransaction.count({ where: { userId: user.id, type: "PACK_PURCHASE" } })).toBe(1);
    await assertLedgerConsistent(user.id);
  });

  it("rejects purchases the user cannot afford without side effects", async () => {
    const user = await createUser({ balance: 450 });
    await expect(openPacks({ userId: user.id, pack: "test-pack", quantity: 5, idempotencyKey: key() })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await balanceOf(user.id)).toBe(450);
    expect(await prisma.userCard.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.packOpening.count({ where: { userId: user.id } })).toBe(0);
  });

  it("never lets concurrent openings overspend a balance", async () => {
    // Remove reward content so that only the purchase affects the balance.
    await prisma.achievement.deleteMany();
    await prisma.mission.deleteMany();
    const user = await createUser({ balance: 300 });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => openPacks({ userId: user.id, pack: "test-pack", quantity: 1, idempotencyKey: key() })));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(3);
    expect(await prisma.packOpening.count({ where: { userId: user.id } })).toBe(3);
    expect(await assertLedgerConsistent(user.id)).toBe(0);
  });

  it("refuses inactive packs", async () => {
    const user = await createUser({ balance: 1_000 });
    await prisma.pack.update({ where: { id: fx.packId }, data: { isActive: false } });
    await expect(openPacks({ userId: user.id, pack: "test-pack", quantity: 1, idempotencyKey: key() })).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("redeems a free-pack voucher exactly once", async () => {
    const user = await createUser({ balance: 0 });
    await prisma.packVoucher.create({ data: { userId: user.id, packId: fx.packId, source: "ADMIN" } });
    const res = await openPacks({ userId: user.id, pack: "test-pack", quantity: 1, idempotencyKey: key(), useVoucher: true });
    expect(res.usedVoucher).toBe(true);
    expect(res.totalPaid).toBe(0);
    const voucher = await prisma.packVoucher.findFirstOrThrow({ where: { userId: user.id } });
    expect(voucher.redeemedAt).not.toBeNull();
    expect(voucher.openingId).toBe(res.packs[0].openingId);
    await expect(openPacks({ userId: user.id, pack: "test-pack", quantity: 1, idempotencyKey: key(), useVoucher: true })).rejects.toThrow(/voucher/);
  });

  it("uses the latest published odds and keeps older openings verifiable", async () => {
    const user = await createUser({ balance: 10_000 });
    const before = await openPacks({ userId: user.id, pack: "test-pack", quantity: 1, idempotencyKey: key() });
    expect(before.oddsVersion).toBe(1);
    // Change odds to 100% chase and publish a new version.
    await prisma.packRarityOdds.updateMany({ where: { packId: fx.packId }, data: { weightPpm: 0 } });
    await prisma.packRarityOdds.update({ where: { packId_rarity: { packId: fx.packId, rarity: "CHASE" } }, data: { weightPpm: 1_000_000 } });
    const v2 = await withTransaction((tx) => publishPackOdds(tx, fx.packId, "test"));
    expect(v2.version).toBe(2);
    const after = await openPacks({ userId: user.id, pack: "test-pack", quantity: 1, idempotencyKey: key() });
    expect(after.oddsVersion).toBe(2);
    expect(after.packs[0].cards.every((c) => c.rarity === "CHASE")).toBe(true);
    expect((await verifyOpening(before.packs[0].openingId)).valid).toBe(true);
    expect((await verifyOpening(after.packs[0].openingId)).valid).toBe(true);
  });

  it("records chase pulls in the activity feed and unlocks achievements", async () => {
    const user = await createUser({ balance: 10_000 });
    const res = await openPacks({ userId: user.id, pack: "premium-pack", quantity: 1, idempotencyKey: key() });
    expect(res.packs[0].cards.every((c) => c.rarity === "CHASE")).toBe(true);
    expect(await prisma.activityEvent.count({ where: { userId: user.id, type: "BIG_PULL" } })).toBe(3);
    const unlocked = await prisma.userAchievement.findMany({ where: { userId: user.id }, include: { achievement: true } });
    const keys = unlocked.map((u) => u.achievement.key);
    expect(keys).toEqual(expect.arrayContaining(["first-rip", "chase-hunter", "big-hit"]));
    expect(res.notices.some((n) => n.kind === "ACHIEVEMENT")).toBe(true);
    await assertLedgerConsistent(user.id);
  });

  it("advances the 'open packs' mission", async () => {
    const user = await createUser({ balance: 1_000 });
    await openPacks({ userId: user.id, pack: "test-pack", quantity: 5, idempotencyKey: key() });
    const mission = await prisma.mission.findUniqueOrThrow({ where: { key: "daily-open-3" } });
    const progress = await prisma.userMission.findFirstOrThrow({ where: { userId: user.id, missionId: mission.id } });
    expect(progress.progress).toBe(3);
    expect(progress.completedAt).not.toBeNull();
  });
});
