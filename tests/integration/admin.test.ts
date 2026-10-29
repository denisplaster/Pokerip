import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { adjustBalance, removeCard, saveBox, savePackOdds, simulatePackOpenings, updateUserAdmin, saveCard } from "@/server/services/admin";
import { createListing } from "@/server/services/marketplace";
import { openPacks, verifyOpening } from "@/server/services/packs";
import { RARITIES } from "@/lib/rarity";
import { assertLedgerConsistent, balanceOf, createUser, giveCard, seedFixture, type Fixture } from "./fixtures";

let fx: Fixture;
let admin: Awaited<ReturnType<typeof createUser>>;
beforeEach(async () => {
  fx = await seedFixture();
  admin = await createUser({ role: "ADMIN" });
});

const key = () => `k${Math.random().toString(36).slice(2, 14)}`;

describe("admin: balances & users", () => {
  it("adjusts balances through the ledger with an audit trail", async () => {
    const user = await createUser({ balance: 100 });
    await adjustBalance(admin.id, user.id, 900, "Compensation for outage");
    await adjustBalance(admin.id, user.id, -250, "Correction");
    expect(await balanceOf(user.id)).toBe(750);
    const tx = await prisma.walletTransaction.findMany({ where: { userId: user.id, adminId: admin.id } });
    expect(tx).toHaveLength(2);
    expect(await prisma.adminAuditLog.count({ where: { adminId: admin.id, action: "wallet.adjust" } })).toBe(2);
    await expect(adjustBalance(admin.id, user.id, -10_000, "Too much")).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    await assertLedgerConsistent(user.id);
  });

  it("applies a double-submitted adjustment only once", async () => {
    const user = await createUser({ balance: 0 });
    await adjustBalance(admin.id, user.id, 500, "Event prize", "form-key-123");
    await expect(adjustBalance(admin.id, user.id, 500, "Event prize", "form-key-123")).rejects.toThrow();
    expect(await balanceOf(user.id)).toBe(500);
  });

  it("suspends users (pulling their listings) and blocks self-demotion", async () => {
    const user = await createUser();
    const copy = await giveCard(user.id, fx.cards[0].id);
    await createListing(user.id, copy.id, 30);
    await updateUserAdmin(admin.id, user.id, { suspended: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).suspendedAt).not.toBeNull();
    expect(await prisma.marketplaceListing.count({ where: { sellerId: user.id, status: "ACTIVE" } })).toBe(0);
    expect((await prisma.userCard.findUniqueOrThrow({ where: { id: copy.id } })).status).toBe("OWNED");
    await expect(updateUserAdmin(admin.id, admin.id, { role: "USER" })).rejects.toThrow(/your own account/);
    await expect(updateUserAdmin(admin.id, admin.id, { suspended: true })).rejects.toThrow(/your own account/);
  });
});

describe("admin: odds configuration", () => {
  const currentPool = async () => (await prisma.packDropPool.findMany({ where: { packId: fx.packId } })).map((p) => ({ cardId: p.cardId, weight: p.weight }));

  it("rejects odds that don't sum to 100% or leave a tier empty", async () => {
    const pool = await currentPool();
    const bad = RARITIES.map((r) => ({ rarity: r, weightPpm: r === "COMMON" ? 900_000 : 0 }));
    await expect(savePackOdds(admin.id, fx.packId, { odds: bad, pool })).rejects.toThrow(/sum to 100%/);
    const chaseIds = new Set(fx.cards.filter((c) => c.rarity === "CHASE").map((c) => c.id));
    const odds = RARITIES.map((r) => ({ rarity: r, weightPpm: r === "COMMON" ? 998_000 : r === "CHASE" ? 2_000 : 0 }));
    await expect(savePackOdds(admin.id, fx.packId, { odds, pool: pool.filter((p) => !chaseIds.has(p.cardId)) })).rejects.toThrow(/no eligible cards/);
    // Nothing was written.
    expect(await prisma.oddsVersion.count({ where: { packId: fx.packId } })).toBe(1);
  });

  it("publishes a new version that future openings use, keeping old openings verifiable", async () => {
    await prisma.pack.update({ where: { id: fx.packId }, data: { price: 2_000 } });
    const user = await createUser({ balance: 10_000 });
    const before = await openPacks({ userId: user.id, pack: fx.packId, quantity: 1, idempotencyKey: key() });
    const pool = await currentPool();
    const odds = RARITIES.map((r) => ({ rarity: r, weightPpm: r === "RARE" ? 1_000_000 : 0 }));
    const res = await savePackOdds(admin.id, fx.packId, { odds, pool });
    expect(res.version).toBe(2);
    const after = await openPacks({ userId: user.id, pack: fx.packId, quantity: 1, idempotencyKey: key() });
    expect(after.packs[0].cards.every((c) => c.rarity === "RARE")).toBe(true);
    expect((await verifyOpening(before.packs[0].openingId)).valid).toBe(true);
    expect(await prisma.adminAuditLog.count({ where: { action: "pack.odds" } })).toBe(1);
  });

  it("refuses pack settings that would let players profit by opening and instantly selling", async () => {
    const { savePackDetails } = await import("@/server/services/admin");
    const details = { name: "Test Pack", slug: "test-pack", tagline: "", description: "", price: 100, cardsPerPack: 5, theme: "trainer", isActive: true, featured: false, sortOrder: 0 };
    // The fixture pack's expected value (~990 RC) is far above a 100 RC price.
    await expect(savePackDetails(admin.id, fx.packId, details)).rejects.toThrow(/instantly selling/);
    await expect(savePackDetails(admin.id, fx.packId, { ...details, price: 2_000 })).resolves.toBeTruthy();
  });

  it("simulates published odds with a good statistical fit", async () => {
    const report = await simulatePackOpenings(fx.packId, 10_000);
    expect(report.cards).toBe(50_000);
    expect(report.chiSquare.pValue).toBeGreaterThan(1e-6);
    expect(Math.abs(report.averageValue - report.expectedValue) / report.expectedValue).toBeLessThan(0.25);
  });
});

describe("admin: cards & boxes", () => {
  it("retires owned cards instead of deleting them and republishes affected packs", async () => {
    const user = await createUser();
    const card = fx.cards.find((c) => c.rarity === "COMMON" && c.setId === fx.setIds[0])!;
    await giveCard(user.id, card.id);
    const res = await removeCard(admin.id, card.id);
    expect(res).toEqual({ removed: false, retired: true });
    expect((await prisma.card.findUniqueOrThrow({ where: { id: card.id } })).isActive).toBe(false);
    expect(await prisma.packDropPool.count({ where: { cardId: card.id } })).toBe(0);
    expect(await prisma.oddsVersion.count({ where: { packId: fx.packId } })).toBe(2);
    expect(await prisma.userCard.count({ where: { cardId: card.id } })).toBe(1);
  });

  it("refuses to remove the last card of a tier that still has odds", async () => {
    const chase = fx.cards.filter((c) => c.rarity === "CHASE");
    await removeCard(admin.id, chase[0].id);
    await removeCard(admin.id, chase[1].id);
    await expect(removeCard(admin.id, chase[2].id)).rejects.toThrow(/without eligible cards/);
    expect(await prisma.card.count({ where: { id: chase[2].id } })).toBe(1);
  });

  it("records a price-history point when an admin changes a card's value", async () => {
    const card = await prisma.card.findFirstOrThrow({ where: { rarity: "RARE" }, include: { set: true } });
    await saveCard(admin.id, card.id, {
      name: card.name,
      pokemon: card.pokemon,
      setId: card.setId,
      number: card.number,
      variant: card.variant,
      rarity: "RARE",
      energyType: card.energyType,
      imageUrl: null,
      grade: null,
      releaseYear: card.releaseYear,
      category: card.category,
      baseValue: card.baseValue,
      currentValue: card.currentValue + 50,
      isActive: true,
    });
    const history = await prisma.cardPriceHistory.findMany({ where: { cardId: card.id } });
    expect(history.at(-1)?.price).toBe(card.currentValue + 50);
  });

  it("validates mystery box configuration and publishes odds versions", async () => {
    const base = { name: "Admin Box", slug: "admin-box", tagline: "", description: "", price: 100, theme: "cyan", isActive: true, featured: false, sortOrder: 1 };
    const coins = (label: string, weightPpm: number, amount: number) => ({ type: "COINS" as const, label, weightPpm, coins: amount, packId: null, collectibleId: null, fallbackCoins: null, cards: [] });
    await expect(saveBox(admin.id, null, { ...base, rewards: [coins("a", 500_000, 10)] })).rejects.toThrow(/sum to 100%/);
    const created = await saveBox(admin.id, null, { ...base, rewards: [coins("a", 500_000, 10), coins("b", 500_000, 200)] });
    expect(created.oddsVersion).toBe(1);
    const updated = await saveBox(admin.id, created.id, { ...base, rewards: [coins("only", 1_000_000, 90)] });
    expect(updated.oddsVersion).toBe(2);
  });
});
