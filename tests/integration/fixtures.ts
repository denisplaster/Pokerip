/**
 * Compact deterministic fixture used by the integration suite: a handful of
 * cards in every rarity, two packs with published odds, a mystery box,
 * progression content and default settings.
 */
import { randomUUID } from "node:crypto";
import { DEFAULT_ACTIVITY, DEFAULT_ECONOMY, DEFAULT_MARKET } from "@/lib/constants";
import { RARITIES, type RarityKey } from "@/lib/rarity";
import { prisma, withTransaction } from "@/server/db";
import { invalidatePriceCache } from "@/server/services/cards";
import { publishBoxOdds, publishPackOdds } from "@/server/services/odds";
import { invalidateSettingsCache } from "@/server/services/settings";
import { createUserWithWallet } from "@/server/services/users";
import { resetRateLimits } from "@/server/rate-limit";
import { ACHIEVEMENTS, DAILY_REWARDS, MISSIONS } from "../../prisma/data/game";

export async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  invalidateSettingsCache();
  invalidatePriceCache();
  resetRateLimits();
}

export const VALUES: Record<RarityKey, number> = {
  COMMON: 10,
  UNCOMMON: 30,
  RARE: 120,
  ULTRA_RARE: 800,
  SECRET_RARE: 4_000,
  CHASE: 25_000,
};

export interface Fixture {
  setIds: string[];
  cards: { id: string; rarity: RarityKey; setId: string; value: number }[];
  packId: string;
  premiumPackId: string;
  boxId: string;
  collectibleId: string;
}

export async function seedFixture(): Promise<Fixture> {
  await resetDatabase();
  const setA = await prisma.cardSet.create({ data: { code: "tst1", name: "Test Set", series: "Test", releaseYear: 2024 } });
  const setB = await prisma.cardSet.create({ data: { code: "tst2", name: "Mini Set", series: "Test", releaseYear: 2025 } });
  const cards: Fixture["cards"] = [];
  for (const rarity of RARITIES) {
    for (let i = 0; i < 3; i++) {
      const id = randomUUID();
      const value = VALUES[rarity] + i;
      cards.push({ id, rarity, setId: setA.id, value });
      await prisma.card.create({
        data: { id, slug: `tst-${rarity.toLowerCase()}-${i}`, setId: setA.id, name: `${rarity} Card ${i}`, number: `${cards.length}/18`, rarity, category: "MODERN", releaseYear: 2024, baseValue: value, currentValue: value },
      });
    }
  }
  // A two-card mini set that is easy to complete.
  for (let i = 0; i < 2; i++) {
    const id = randomUUID();
    cards.push({ id, rarity: "COMMON", setId: setB.id, value: 5 });
    await prisma.card.create({
      data: { id, slug: `mini-${i}`, setId: setB.id, name: `Mini ${i}`, number: `${i + 1}/2`, rarity: "COMMON", category: "MODERN", releaseYear: 2025, baseValue: 5, currentValue: 5 },
    });
  }

  const pack = await prisma.pack.create({
    data: {
      slug: "test-pack",
      name: "Test Pack",
      tagline: "",
      description: "",
      price: 100,
      cardsPerPack: 5,
      theme: "trainer",
      odds: {
        create: [
          { rarity: "COMMON", weightPpm: 550_000 },
          { rarity: "UNCOMMON", weightPpm: 250_000 },
          { rarity: "RARE", weightPpm: 120_000 },
          { rarity: "ULTRA_RARE", weightPpm: 60_000 },
          { rarity: "SECRET_RARE", weightPpm: 18_000 },
          { rarity: "CHASE", weightPpm: 2_000 },
        ],
      },
      pool: { create: cards.filter((c) => c.setId === setA.id).map((c) => ({ cardId: c.id, weight: 100 })) },
    },
  });
  const premium = await prisma.pack.create({
    data: {
      slug: "premium-pack",
      name: "Premium Pack",
      tagline: "",
      description: "",
      price: 5_000,
      cardsPerPack: 3,
      theme: "legendary",
      odds: { create: RARITIES.map((r) => ({ rarity: r, weightPpm: r === "CHASE" ? 1_000_000 : 0 })) },
      pool: { create: cards.filter((c) => c.rarity === "CHASE").map((c) => ({ cardId: c.id, weight: 100 })) },
    },
  });
  await withTransaction(async (tx) => {
    await publishPackOdds(tx, pack.id, "test");
    await publishPackOdds(tx, premium.id, "test");
  });

  const collectible = await prisma.collectible.create({
    data: { slug: "tst-crown", name: "Test Crown", description: "", rarity: "CHASE", icon: "crown", value: 1_000, maxSupply: 2 },
  });
  const box = await prisma.mysteryBox.create({
    data: {
      slug: "test-box",
      name: "Test Box",
      tagline: "",
      description: "",
      price: 200,
      theme: "purple",
      rewards: { create: [{ type: "COLLECTIBLE", label: "Crown", weightPpm: 1_000_000, collectibleId: collectible.id, fallbackCoins: 150 }] },
    },
  });
  await withTransaction((tx) => publishBoxOdds(tx, box.id, "test"));

  await prisma.dailyReward.createMany({ data: DAILY_REWARDS.map((d) => ({ day: d.day, coins: d.coins, xp: d.xp, label: d.label, packId: d.pack ? pack.id : null })) });
  await prisma.mission.createMany({ data: MISSIONS.map((m, i) => ({ ...m, sortOrder: i })) });
  await prisma.achievement.createMany({ data: ACHIEVEMENTS.map((a, i) => ({ ...a, sortOrder: i })) });
  await prisma.systemSetting.createMany({
    data: [
      { key: "economy", value: DEFAULT_ECONOMY as object },
      { key: "market", value: DEFAULT_MARKET as object },
      { key: "activity", value: DEFAULT_ACTIVITY as object },
    ],
  });
  invalidateSettingsCache();
  return { setIds: [setA.id, setB.id], cards, packId: pack.id, premiumPackId: premium.id, boxId: box.id, collectibleId: collectible.id };
}

let counter = 0;
/** Test users default to level 3 so they can trade on the marketplace. */
export async function createUser(opts: { balance?: number; role?: "USER" | "ADMIN"; level?: number } = {}) {
  const n = ++counter;
  const user = await withTransaction((tx) => createUserWithWallet(tx, { username: `user${n}_${Date.now() % 100000}`, email: `user${n}_${Date.now()}@test.dev` }));
  if (opts.balance !== undefined) {
    // Adjust through raw SQL plus a balancing ledger row so invariants still hold.
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    const delta = opts.balance - wallet.balance;
    if (delta !== 0) {
      await prisma.walletTransaction.create({
        data: { walletId: wallet.id, userId: user.id, type: "ADMIN_ADJUSTMENT", amount: delta, balanceBefore: wallet.balance, balanceAfter: opts.balance, description: "test fixture" },
      });
      await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: opts.balance } });
    }
  }
  await prisma.user.update({ where: { id: user.id }, data: { level: opts.level ?? 3, ...(opts.role ? { role: opts.role } : {}) } });
  return user;
}

export async function balanceOf(userId: string) {
  return (await prisma.wallet.findUniqueOrThrow({ where: { userId } })).balance;
}

/** Ledger invariant: the wallet balance equals the sum of all ledger entries. */
export async function assertLedgerConsistent(userId: string) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  const agg = await prisma.walletTransaction.aggregate({ where: { userId }, _sum: { amount: true } });
  if ((agg._sum.amount ?? 0) !== wallet.balance) throw new Error(`Ledger mismatch for ${userId}: ${agg._sum.amount} vs ${wallet.balance}`);
  return wallet.balance;
}

export async function giveCard(userId: string, cardId: string, value = 10) {
  return prisma.userCard.create({ data: { userId, cardId, source: "ADMIN", acquiredValue: value } });
}
