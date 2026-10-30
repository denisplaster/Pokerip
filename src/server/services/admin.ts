/**
 * Administrator operations. Every function here is called only from routes
 * guarded by `requireApiAdmin`, and every mutation writes an AdminAuditLog row.
 */
import type { Prisma, TransactionType } from "@/generated/prisma/client";
import { addUtcDays, startOfUtcDay } from "@/lib/dates";
import {
  buildPackSnapshot,
  cardSlotProbabilities,
  chiSquareTest,
  compilePackOdds,
  expectedPackValue,
  PPM,
  simulatePacks,
  validatePackSnapshot,
  OddsConfigError,
  type PackOddsSnapshot,
} from "@/lib/probability";
import { RARITIES, type RarityKey } from "@/lib/rarity";
import { cryptoRng } from "../crypto-rng";
import { prisma, withTransaction, type Tx } from "../db";
import { AppError, badRequest, conflict, notFound } from "../errors";
import { CARD_VIEW_SELECT, invalidatePriceCache, toCardView } from "./cards";
import { getLatestPackOdds, publishBoxOdds, publishPackOdds } from "./odds";
import { saveSettings, type SystemSettings } from "./settings";
import { getSettings as readSettings } from "./settings";
import { applyWalletChange, lockWallets } from "./wallet";

export async function audit(tx: Tx, adminId: string, action: string, targetType: string, targetId: string | null, details?: unknown) {
  await tx.adminAuditLog.create({ data: { adminId, action, targetType, targetId, details: details as object | undefined } });
}

// ── Analytics ────────────────────────────────────────────────────────────────

const ISSUANCE_TYPES: TransactionType[] = [
  "SIGNUP_BONUS",
  "DAILY_REWARD",
  "MISSION_REWARD",
  "ACHIEVEMENT_REWARD",
  "LEVEL_UP_REWARD",
  "CARD_SALE",
  "MYSTERY_BOX_REWARD",
  "ADMIN_ADJUSTMENT",
];

export async function getAdminStats(days = 30) {
  const now = new Date();
  const since = addUtcDays(startOfUtcDay(now), -(days - 1));
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [users, newUsers, activeDay, activeWeek, circulation, openingsTotal, openingsDay, cardsOwned, activeListings, marketWeek, daily, byType, pullsByRarity, packMix, fees, packSpend, packValue] =
    await Promise.all([
      prisma.user.count({ where: { isBot: false } }),
      prisma.user.count({ where: { isBot: false, createdAt: { gte: weekAgo } } }),
      prisma.packOpening.findMany({ where: { createdAt: { gte: dayAgo } }, distinct: ["userId"], select: { userId: true } }),
      prisma.packOpening.findMany({ where: { createdAt: { gte: weekAgo } }, distinct: ["userId"], select: { userId: true } }),
      prisma.wallet.aggregate({ _sum: { balance: true } }),
      prisma.packOpening.count(),
      prisma.packOpening.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.userCard.count(),
      prisma.marketplaceListing.count({ where: { status: "ACTIVE" } }),
      prisma.marketplaceTransaction.aggregate({ where: { createdAt: { gte: weekAgo } }, _sum: { price: true }, _count: true }),
      prisma.$queryRaw<{ day: Date; issued: bigint; spent: bigint; openings: bigint }[]>`
        WITH days AS (SELECT generate_series(${since}::timestamp, ${startOfUtcDay(now)}::timestamp, interval '1 day') AS day),
        tx AS (
          SELECT date_trunc('day', "createdAt") AS day,
                 SUM(CASE WHEN "amount" > 0 AND "type"::text = ANY(${ISSUANCE_TYPES}::text[]) THEN "amount" ELSE 0 END) AS issued,
                 SUM(CASE WHEN "amount" < 0 AND "type"::text IN ('PACK_PURCHASE','MYSTERY_BOX_PURCHASE','ADMIN_ADJUSTMENT') THEN -"amount" ELSE 0 END) AS spent
          FROM "WalletTransaction" WHERE "createdAt" >= ${since} GROUP BY 1
        ),
        op AS (SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS openings FROM "PackOpening" WHERE "createdAt" >= ${since} GROUP BY 1)
        SELECT d.day, COALESCE(tx.issued, 0)::bigint AS issued, COALESCE(tx.spent, 0)::bigint AS spent, COALESCE(op.openings, 0)::bigint AS openings
        FROM days d LEFT JOIN tx ON tx.day = d.day LEFT JOIN op ON op.day = d.day ORDER BY d.day`,
      prisma.walletTransaction.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _sum: { amount: true }, _count: true }),
      prisma.packOpeningReward.groupBy({ by: ["rarity"], where: { createdAt: { gte: since } }, _count: true }),
      prisma.packOpening.groupBy({ by: ["packId"], where: { createdAt: { gte: since } }, _count: true, _sum: { pricePaid: true, totalValue: true } }),
      prisma.marketplaceTransaction.aggregate({ where: { createdAt: { gte: since } }, _sum: { fee: true } }),
      prisma.packOpening.aggregate({ where: { createdAt: { gte: since } }, _sum: { pricePaid: true } }),
      prisma.packOpening.aggregate({ where: { createdAt: { gte: since } }, _sum: { totalValue: true } }),
    ]);

  // Expected rarity mix given which packs were opened (using each pack's current odds).
  const packs = await prisma.pack.findMany({ where: { id: { in: packMix.map((p) => p.packId) } }, select: { id: true, name: true, slug: true, cardsPerPack: true, price: true } });
  const expected = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<RarityKey, number>;
  for (const mix of packMix) {
    const pack = packs.find((p) => p.id === mix.packId);
    if (!pack) continue;
    const { version } = await getLatestPackOdds(pack.id).catch(() => ({ version: null }));
    if (!version) continue;
    const snap = version.data as unknown as PackOddsSnapshot;
    for (const tier of snap.tiers) expected[tier.rarity] += (mix._count * snap.cardsPerPack * tier.weightPpm) / PPM;
  }
  const observedTotal = pullsByRarity.reduce((s, r) => s + r._count, 0);
  const expectedTotal = Object.values(expected).reduce((a, b) => a + b, 0);

  return {
    days,
    kpis: {
      users,
      newUsers7d: newUsers,
      activeUsers24h: activeDay.length,
      activeUsers7d: activeWeek.length,
      circulation: circulation._sum.balance ?? 0,
      packsOpened: openingsTotal,
      packsOpened24h: openingsDay,
      cardsOwned,
      activeListings,
      marketVolume7d: marketWeek._sum.price ?? 0,
      marketSales7d: marketWeek._count,
      marketplaceFees: fees._sum.fee ?? 0,
      realizedRtp: (packSpend._sum.pricePaid ?? 0) > 0 ? (packValue._sum.totalValue ?? 0) / (packSpend._sum.pricePaid ?? 1) : null,
    },
    daily: daily.map((d) => ({ day: d.day.toISOString().slice(0, 10), issued: Number(d.issued), spent: Number(d.spent), openings: Number(d.openings) })),
    byType: byType
      .map((t) => ({ type: t.type, total: t._sum.amount ?? 0, count: t._count }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    rarity: RARITIES.map((r) => ({
      rarity: r,
      observed: pullsByRarity.find((p) => p.rarity === r)?._count ?? 0,
      observedShare: observedTotal ? (pullsByRarity.find((p) => p.rarity === r)?._count ?? 0) / observedTotal : 0,
      expectedShare: expectedTotal ? expected[r] / expectedTotal : 0,
    })),
    packs: packMix
      .map((m) => {
        const p = packs.find((x) => x.id === m.packId);
        return {
          id: m.packId,
          name: p?.name ?? "Unknown",
          openings: m._count,
          spent: m._sum.pricePaid ?? 0,
          value: m._sum.totalValue ?? 0,
        };
      })
      .sort((a, b) => b.openings - a.openings),
  };
}

export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;

// ── Users ────────────────────────────────────────────────────────────────────

export async function listUsers(query: { q?: string; page: number; limit: number }) {
  const where: Prisma.UserWhereInput = query.q
    ? { OR: [{ username: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q, mode: "insensitive" } }] }
    : {};
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        level: true,
        packsOpened: true,
        isBot: true,
        suspendedAt: true,
        createdAt: true,
        wallet: { select: { balance: true } },
        _count: { select: { cards: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { items: rows, total, page: query.page, pages: Math.max(1, Math.ceil(total / query.limit)) };
}

export async function getUserAdminDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      level: true,
      xp: true,
      packsOpened: true,
      boxesOpened: true,
      loginStreak: true,
      isBot: true,
      suspendedAt: true,
      createdAt: true,
      profileVisibility: true,
      wallet: { select: { balance: true, lifetimeEarned: true, lifetimeSpent: true } },
      _count: { select: { cards: true, listings: true, achievements: true } },
    },
  });
  if (!user) throw notFound("User");
  const transactions = await prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 30,
    select: { id: true, type: true, amount: true, balanceBefore: true, balanceAfter: true, description: true, createdAt: true, admin: { select: { username: true } } },
  });
  const ledger = await prisma.walletTransaction.aggregate({ where: { userId }, _sum: { amount: true } });
  const wallet = user.wallet
    ? { balance: user.wallet.balance, lifetimeEarned: Number(user.wallet.lifetimeEarned), lifetimeSpent: Number(user.wallet.lifetimeSpent) }
    : null;
  return { user: { ...user, wallet }, transactions, ledgerConsistent: (ledger._sum.amount ?? 0) === (user.wallet?.balance ?? 0) };
}

export async function adjustBalance(adminId: string, userId: string, amount: number, reason: string, idempotencyKey?: string) {
  return withTransaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
    if (!target) throw notFound("User");
    const res = await applyWalletChange(tx, {
      userId,
      amount,
      type: "ADMIN_ADJUSTMENT",
      description: `Admin adjustment: ${reason}`,
      adminId,
      // A double-submitted form reuses its key and is rejected as a duplicate.
      idempotencyKey: idempotencyKey ? `admin-adjust:${adminId}:${idempotencyKey}` : undefined,
      metadata: { reason },
    });
    await audit(tx, adminId, "wallet.adjust", "User", userId, { amount, reason, balanceAfter: res.balance, username: target.username });
    return { balance: res.balance, transactionId: res.transaction.id };
  });
}

export async function updateUserAdmin(adminId: string, userId: string, input: { role?: "USER" | "ADMIN"; suspended?: boolean }) {
  if (userId === adminId && (input.role === "USER" || input.suspended)) throw badRequest("You can't demote or suspend your own account.");
  return withTransaction(async (tx) => {
    // Follow the global lock order (wallet before user/listing rows) so this can't
    // deadlock with a marketplace purchase of the same user's listing.
    await lockWallets(tx, [userId]);
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound("User");
    const data: Prisma.UserUpdateInput = {};
    if (input.role) data.role = input.role;
    if (input.suspended !== undefined) data.suspendedAt = input.suspended ? new Date() : null;
    const updated = await tx.user.update({ where: { id: userId }, data, select: { id: true, role: true, suspendedAt: true } });
    if (input.suspended) {
      // Pull a suspended user's listings off the market.
      const listings = await tx.marketplaceListing.findMany({ where: { sellerId: userId, status: "ACTIVE" }, select: { id: true, userCardId: true } });
      for (const l of listings) {
        // Conditional update: never overwrite a listing that sold in the meantime.
        const cancelled = await tx.marketplaceListing.updateMany({ where: { id: l.id, status: "ACTIVE" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
        if (cancelled.count && l.userCardId) await tx.userCard.updateMany({ where: { id: l.userCardId, userId, status: "LISTED" }, data: { status: "OWNED" } });
      }
    }
    await audit(tx, adminId, "user.update", "User", userId, { ...input, username: user.username });
    return updated;
  });
}

// ── Packs ────────────────────────────────────────────────────────────────────

/**
 * Refuses configurations where opening a pack and instantly selling every card
 * back to the platform would, on average, return more RC than the pack costs —
 * that would let players mint unlimited coins.
 */
async function assertPackNotArbitrage(tx: Tx, packId: string, instantSellBps?: number) {
  const pack = await tx.pack.findUnique({ where: { id: packId }, select: { name: true, price: true, isActive: true } });
  if (!pack || !pack.isActive) return;
  const version = await tx.oddsVersion.findFirst({ where: { packId }, orderBy: { version: "desc" } });
  if (!version) return;
  const snapshot = version.data as unknown as PackOddsSnapshot;
  const ids = snapshot.tiers.flatMap((t) => t.cards.map((c) => c.cardId));
  const cards = await tx.card.findMany({ where: { id: { in: ids } }, select: { id: true, currentValue: true } });
  const ev = expectedPackValue(snapshot, new Map(cards.map((c) => [c.id, c.currentValue])));
  const bps = instantSellBps ?? (await readSettings(tx)).economy.instantSellBps;
  const sellBack = (ev * bps) / 10_000;
  if (sellBack >= pack.price) {
    throw new AppError(
      "VALIDATION",
      `${pack.name}: opening and instantly selling would return ${Math.round(sellBack).toLocaleString()} RC on average, more than its ${pack.price.toLocaleString()} RC price. Raise the price or lower the odds.`,
    );
  }
}

export async function getPackAdmin(packId: string) {
  const pack = await prisma.pack.findUnique({
    where: { id: packId },
    include: {
      odds: true,
      pool: { include: { card: { select: CARD_VIEW_SELECT } } },
      oddsVersions: { orderBy: { version: "desc" }, take: 20, select: { id: true, version: true, hash: true, createdAt: true, createdBy: true } },
      _count: { select: { openings: true } },
    },
  });
  if (!pack) throw notFound("Pack");
  return {
    ...pack,
    odds: RARITIES.map((r) => ({ rarity: r, weightPpm: pack.odds.find((o) => o.rarity === r)?.weightPpm ?? 0 })),
    pool: pack.pool.map((p) => ({ cardId: p.cardId, weight: p.weight, card: toCardView(p.card) })),
  };
}

export type PackAdmin = Awaited<ReturnType<typeof getPackAdmin>>;

export async function listPacksAdmin() {
  const packs = await prisma.pack.findMany({
    orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    include: { _count: { select: { openings: true, pool: true } }, oddsVersions: { orderBy: { version: "desc" }, take: 1, select: { version: true, createdAt: true } } },
  });
  return packs;
}

export async function savePackDetails(
  adminId: string,
  packId: string | null,
  input: { name: string; slug: string; tagline: string; description: string; price: number; cardsPerPack: number; theme: string; isActive: boolean; featured: boolean; sortOrder: number },
) {
  return withTransaction(async (tx) => {
    const clash = await tx.pack.findFirst({ where: { slug: input.slug, ...(packId ? { NOT: { id: packId } } : {}) }, select: { id: true } });
    if (clash) throw conflict("Another pack already uses that slug.");
    if (packId) {
      const before = await tx.pack.findUnique({ where: { id: packId } });
      if (!before) throw notFound("Pack");
      const pack = await tx.pack.update({ where: { id: packId }, data: input });
      // cardsPerPack is part of the odds snapshot; publish if the configuration is valid.
      if (before.cardsPerPack !== input.cardsPerPack) await publishPackOdds(tx, packId, adminId);
      await assertPackNotArbitrage(tx, packId);
      await audit(tx, adminId, "pack.update", "Pack", packId, { before: { ...before, createdAt: undefined, updatedAt: undefined }, after: input });
      return pack;
    }
    // New packs start inactive with all odds on Common until configured.
    const pack = await tx.pack.create({
      data: { ...input, isActive: false, odds: { create: RARITIES.map((r) => ({ rarity: r, weightPpm: r === "COMMON" ? PPM : 0 })) } },
    });
    await audit(tx, adminId, "pack.create", "Pack", pack.id, input);
    return pack;
  });
}

export async function savePackOdds(adminId: string, packId: string, input: { odds: { rarity: RarityKey; weightPpm: number }[]; pool: { cardId: string; weight: number }[] }) {
  return withTransaction(async (tx) => {
    const pack = await tx.pack.findUnique({ where: { id: packId }, select: { id: true, cardsPerPack: true } });
    if (!pack) throw notFound("Pack");
    const ids = [...new Set(input.pool.map((p) => p.cardId))];
    if (ids.length !== input.pool.length) throw badRequest("Each card can only appear once in the pool.");
    const cards = await tx.card.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, rarity: true } });
    if (cards.length !== ids.length) throw badRequest("Pool contains unknown or retired cards.");
    const rarityOf = new Map(cards.map((c) => [c.id, c.rarity as RarityKey]));
    // Validate before writing anything.
    const snapshot = buildPackSnapshot(pack.cardsPerPack, input.odds, input.pool.map((p) => ({ ...p, rarity: rarityOf.get(p.cardId)! })));
    const problems = validatePackSnapshot(snapshot);
    if (problems.length) throw new OddsConfigError(problems);

    const before = await getLatestPackOdds(packId, tx).catch(() => null);
    for (const o of input.odds) {
      await tx.packRarityOdds.upsert({
        where: { packId_rarity: { packId, rarity: o.rarity } },
        create: { packId, rarity: o.rarity, weightPpm: o.weightPpm },
        update: { weightPpm: o.weightPpm },
      });
    }
    await tx.packDropPool.deleteMany({ where: { packId } });
    await tx.packDropPool.createMany({ data: input.pool.map((p) => ({ packId, cardId: p.cardId, weight: p.weight })) });
    const version = await publishPackOdds(tx, packId, adminId);
    await assertPackNotArbitrage(tx, packId);
    await audit(tx, adminId, "pack.odds", "Pack", packId, {
      fromVersion: before?.version.version ?? null,
      toVersion: version.version,
      odds: input.odds,
      poolSize: input.pool.length,
    });
    return { version: version.version, hash: version.hash };
  });
}

/** Simulates N packs from the pack's *published* odds with the production RNG. */
export async function simulatePackOpenings(packId: string, packs: number) {
  const pack = await prisma.pack.findUnique({ where: { id: packId }, select: { id: true, name: true, price: true } });
  if (!pack) throw notFound("Pack");
  const { version, compiled } = await getLatestPackOdds(packId);
  const snapshot = compiled.snapshot;
  const ids = snapshot.tiers.flatMap((t) => t.cards.map((c) => c.cardId));
  const cards = await prisma.card.findMany({ where: { id: { in: ids } }, select: CARD_VIEW_SELECT });
  const values = new Map(cards.map((c) => [c.id, c.currentValue]));
  const started = Date.now();
  const sim = simulatePacks(compiled, packs, cryptoRng, values);
  const elapsedMs = Date.now() - started;
  const expectedShares = RARITIES.map((r) => (snapshot.tiers.find((t) => t.rarity === r)?.weightPpm ?? 0) / PPM);
  const observed = RARITIES.map((r) => sim.rarityCounts[r]);
  const chi = chiSquareTest(observed, expectedShares);
  const probs = cardSlotProbabilities(snapshot);
  const byId = new Map(cards.map((c) => [c.id, toCardView(c)]));
  const topCards = [...sim.cardCounts.entries()]
    .map(([id, count]) => ({ card: byId.get(id)!, count, expected: (probs.get(id) ?? 0) * sim.cards }))
    .sort((a, b) => b.card.currentValue - a.card.currentValue)
    .slice(0, 12);

  // Histogram of pack values on a log scale.
  const sortedValues = [...sim.packValues].sort((a, b) => a - b);
  const quantile = (q: number) => sortedValues[Math.min(sortedValues.length - 1, Math.floor(q * sortedValues.length))] ?? 0;
  const maxValue = Math.max(1, sortedValues[sortedValues.length - 1] ?? 1);
  const edges = [0, ...Array.from({ length: 10 }, (_, i) => Math.round(Math.pow(10, (Math.log10(maxValue + 1) * (i + 1)) / 10)))];
  const histogram = edges.slice(0, -1).map((lo, i) => ({
    label: `${lo.toLocaleString()}–${edges[i + 1].toLocaleString()}`,
    count: sortedValues.filter((v) => v >= lo && (i === edges.length - 2 ? v <= edges[i + 1] : v < edges[i + 1])).length,
  }));

  return {
    pack: { id: pack.id, name: pack.name, price: pack.price },
    oddsVersion: version.version,
    packs,
    cards: sim.cards,
    elapsedMs,
    rarity: RARITIES.map((r, i) => ({
      rarity: r,
      observed: observed[i],
      observedShare: observed[i] / sim.cards,
      expectedShare: expectedShares[i],
      expected: expectedShares[i] * sim.cards,
    })),
    chiSquare: chi,
    averageValue: sim.totalValue / packs,
    expectedValue: expectedPackValue(snapshot, values),
    rtp: sim.totalValue / (packs * Math.max(1, pack.price)),
    medianValue: quantile(0.5),
    p90Value: quantile(0.9),
    p99Value: quantile(0.99),
    maxValue: sortedValues[sortedValues.length - 1] ?? 0,
    histogram,
    topCards,
  };
}

export type SimulationReport = Awaited<ReturnType<typeof simulatePackOpenings>>;

// ── Cards ────────────────────────────────────────────────────────────────────

export async function listCardsAdmin(query: { q?: string; rarity?: RarityKey; setId?: string; page: number; limit: number }) {
  const where: Prisma.CardWhereInput = {
    ...(query.rarity ? { rarity: query.rarity } : {}),
    ...(query.setId ? { setId: query.setId } : {}),
    ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { slug: { contains: query.q, mode: "insensitive" } }, { number: { contains: query.q } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.card.findMany({
      where,
      orderBy: [{ set: { releaseYear: "asc" } }, { setId: "asc" }, { createdAt: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: { ...CARD_VIEW_SELECT, baseValue: true, isActive: true, setId: true, _count: { select: { owned: true, pools: true } } },
    }),
    prisma.card.count({ where }),
  ]);
  return { items: rows.map((r) => ({ ...r, rarity: r.rarity as RarityKey })), total, page: query.page, pages: Math.max(1, Math.ceil(total / query.limit)) };
}

interface CardInput {
  name: string;
  pokemon: string | null;
  setId: string;
  number: string;
  variant: string | null;
  rarity: RarityKey;
  energyType: string;
  imageUrl: string | null;
  grade: string | null;
  releaseYear: number;
  category: "VINTAGE" | "MODERN" | "ILLUSTRATION" | "GRADED" | "PROMO";
  baseValue: number;
  currentValue: number;
  isActive: boolean;
}

async function republishPacksForCard(tx: Tx, cardId: string, adminId: string) {
  const pools = await tx.packDropPool.findMany({ where: { cardId }, select: { packId: true } });
  for (const { packId } of pools) {
    try {
      await publishPackOdds(tx, packId, adminId);
    } catch (e) {
      if (e instanceof OddsConfigError) throw new AppError("VALIDATION", `Change would leave pack odds invalid: ${e.problems.join("; ")}`);
      throw e;
    }
  }
}

export async function saveCard(adminId: string, cardId: string | null, input: CardInput) {
  return withTransaction(async (tx) => {
    const set = await tx.cardSet.findUnique({ where: { id: input.setId } });
    if (!set) throw badRequest("Unknown set.");
    if (cardId) {
      const before = await tx.card.findUnique({ where: { id: cardId } });
      if (!before) throw notFound("Card");
      const card = await tx.card.update({ where: { id: cardId }, data: input });
      if (before.currentValue !== input.currentValue) {
        await tx.cardPriceHistory.create({ data: { cardId, price: input.currentValue, volume: 0, recordedAt: new Date() } });
      }
      // Rarity or availability changes alter pack snapshots → publish new odds versions.
      if (before.rarity !== input.rarity || before.isActive !== input.isActive) await republishPacksForCard(tx, cardId, adminId);
      await audit(tx, adminId, "card.update", "Card", cardId, { before: { name: before.name, rarity: before.rarity, baseValue: before.baseValue, currentValue: before.currentValue, isActive: before.isActive }, after: input });
      invalidatePriceCache();
      return card;
    }
    const slugBase = `${set.code}-${input.number.split("/")[0].toLowerCase().replace(/[^a-z0-9]+/g, "")}${input.grade ? `-${input.grade.toLowerCase().replace(/[^a-z0-9]+/g, "")}` : ""}`;
    let slug = slugBase;
    for (let i = 2; await tx.card.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${slugBase}-${i}`;
    const card = await tx.card.create({ data: { ...input, slug } });
    await tx.cardPriceHistory.create({ data: { cardId: card.id, price: input.currentValue, volume: 0, recordedAt: new Date() } });
    await audit(tx, adminId, "card.create", "Card", card.id, input);
    invalidatePriceCache();
    return card;
  });
}

/** Deletes a card that nobody has ever owned; otherwise retires it (removed from pools). */
export async function removeCard(adminId: string, cardId: string) {
  return withTransaction(async (tx) => {
    const card = await tx.card.findUnique({ where: { id: cardId }, include: { _count: { select: { owned: true, rewards: true, listings: true, marketSales: true } } } });
    if (!card) throw notFound("Card");
    const pools = await tx.packDropPool.findMany({ where: { cardId }, select: { packId: true } });
    const used = card._count.owned + card._count.rewards + card._count.listings + card._count.marketSales > 0;
    if (used) {
      await tx.card.update({ where: { id: cardId }, data: { isActive: false } });
      await tx.packDropPool.deleteMany({ where: { cardId } });
    } else {
      await tx.packDropPool.deleteMany({ where: { cardId } });
      await tx.card.delete({ where: { id: cardId } });
    }
    for (const { packId } of pools) {
      try {
        await publishPackOdds(tx, packId, adminId);
      } catch (e) {
        if (e instanceof OddsConfigError) throw new AppError("VALIDATION", `Removing this card would leave a pack without eligible cards for a tier: ${e.problems.join("; ")}`);
        throw e;
      }
    }
    await audit(tx, adminId, used ? "card.retire" : "card.delete", "Card", cardId, { name: card.name, packsAffected: pools.length });
    return { removed: !used, retired: used };
  });
}

// ── Mystery boxes ────────────────────────────────────────────────────────────

export async function saveBox(
  adminId: string,
  boxId: string | null,
  input: {
    name: string;
    slug: string;
    tagline: string;
    description: string;
    price: number;
    theme: string;
    isActive: boolean;
    featured: boolean;
    sortOrder: number;
    rewards: {
      type: "CARD" | "CARD_BUNDLE" | "COINS" | "PACK_VOUCHER" | "COLLECTIBLE";
      label: string;
      weightPpm: number;
      coins: number | null;
      packId: string | null;
      collectibleId: string | null;
      fallbackCoins: number | null;
      cards: { cardId: string; quantity: number }[];
    }[];
  },
) {
  const total = input.rewards.reduce((s, r) => s + r.weightPpm, 0);
  if (total !== PPM) throw new AppError("VALIDATION", `Reward probabilities must sum to 100% (got ${(total / 10_000).toFixed(4)}%).`);
  for (const r of input.rewards) {
    if (r.type === "COINS" && !r.coins) throw badRequest(`"${r.label}": coin rewards need an amount.`);
    if ((r.type === "CARD" || r.type === "CARD_BUNDLE") && r.cards.length === 0) throw badRequest(`"${r.label}": add at least one card.`);
    if (r.type === "CARD" && (r.cards.length !== 1 || r.cards[0].quantity !== 1)) throw badRequest(`"${r.label}": single-card rewards hold exactly one card.`);
    if (r.type === "PACK_VOUCHER" && !r.packId) throw badRequest(`"${r.label}": choose a pack.`);
    if (r.type === "COLLECTIBLE" && (!r.collectibleId || r.fallbackCoins === null)) throw badRequest(`"${r.label}": choose a collectible and its sold-out coin fallback.`);
  }
  return withTransaction(async (tx) => {
    const clash = await tx.mysteryBox.findFirst({ where: { slug: input.slug, ...(boxId ? { NOT: { id: boxId } } : {}) }, select: { id: true } });
    if (clash) throw conflict("Another box already uses that slug.");
    const { rewards, ...details } = input;
    const box = boxId ? await tx.mysteryBox.update({ where: { id: boxId }, data: details }) : await tx.mysteryBox.create({ data: details });
    // Rewards referenced by past openings are kept for auditability; only unreferenced ones are deleted.
    const existing = await tx.mysteryBoxReward.findMany({ where: { boxId: box.id }, select: { id: true, _count: { select: { openings: true } } } });
    for (const r of existing) {
      if (r._count.openings > 0) await tx.mysteryBoxReward.update({ where: { id: r.id }, data: { weightPpm: 0, sortOrder: 9999 } });
      else await tx.mysteryBoxReward.delete({ where: { id: r.id } });
    }
    for (const [i, r] of rewards.entries()) {
      await tx.mysteryBoxReward.create({
        data: {
          boxId: box.id,
          type: r.type,
          label: r.label,
          weightPpm: r.weightPpm,
          coins: r.type === "COINS" ? r.coins : null,
          packId: r.type === "PACK_VOUCHER" ? r.packId : null,
          collectibleId: r.type === "COLLECTIBLE" ? r.collectibleId : null,
          fallbackCoins: r.type === "COLLECTIBLE" ? r.fallbackCoins : null,
          sortOrder: i,
          cards: r.type === "CARD" || r.type === "CARD_BUNDLE" ? { create: r.cards } : undefined,
        },
      });
    }
    const version = await publishBoxOdds(tx, box.id, adminId);
    await audit(tx, adminId, boxId ? "box.update" : "box.create", "MysteryBox", box.id, { ...details, rewards: rewards.map((r) => ({ label: r.label, type: r.type, weightPpm: r.weightPpm })), oddsVersion: version.version });
    return { id: box.id, oddsVersion: version.version };
  });
}

export async function getBoxAdmin(boxId: string) {
  const box = await prisma.mysteryBox.findUnique({
    where: { id: boxId },
    include: {
      rewards: { where: { weightPpm: { gt: 0 } }, orderBy: { sortOrder: "asc" }, include: { cards: { include: { card: { select: CARD_VIEW_SELECT } } } } },
      oddsVersions: { orderBy: { version: "desc" }, take: 10, select: { version: true, hash: true, createdAt: true } },
      _count: { select: { openings: true } },
    },
  });
  if (!box) throw notFound("Mystery box");
  return box;
}

// ── Ledger, settings & audit ─────────────────────────────────────────────────

export async function listTransactionsAdmin(query: { type?: TransactionType; username?: string; from?: Date; to?: Date; page: number; limit: number }) {
  const where: Prisma.WalletTransactionWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.username ? { user: { username: { contains: query.username, mode: "insensitive" } } } : {}),
    ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
  };
  const [rows, total, sum] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        description: true,
        createdAt: true,
        idempotencyKey: true,
        user: { select: { id: true, username: true } },
        admin: { select: { username: true } },
      },
    }),
    prisma.walletTransaction.count({ where }),
    prisma.walletTransaction.aggregate({ where, _sum: { amount: true } }),
  ]);
  return { items: rows, total, net: sum._sum.amount ?? 0, page: query.page, pages: Math.max(1, Math.ceil(total / query.limit)) };
}

export async function saveSystemSettings(adminId: string, settings: SystemSettings) {
  return withTransaction(async (tx) => {
    const active = await tx.pack.findMany({ where: { isActive: true }, select: { id: true } });
    for (const p of active) await assertPackNotArbitrage(tx, p.id, settings.economy.instantSellBps);
    await saveSettings(tx, settings, adminId);
    await audit(tx, adminId, "settings.update", "SystemSetting", null, settings);
    return settings;
  });
}

export async function saveDailyRewards(adminId: string, days: { day: number; coins: number; xp: number; packId: string | null; label: string }[]) {
  const unique = new Set(days.map((d) => d.day));
  if (unique.size !== 7) throw badRequest("Provide exactly one entry for each of days 1–7.");
  return withTransaction(async (tx) => {
    for (const d of days) {
      await tx.dailyReward.upsert({ where: { day: d.day }, create: d, update: d });
    }
    await audit(tx, adminId, "daily.update", "DailyReward", null, days);
    return { ok: true };
  });
}

export async function updateMission(adminId: string, missionId: string, input: { title: string; description: string; target: number; rewardCoins: number; rewardXp: number; isActive: boolean }) {
  return withTransaction(async (tx) => {
    const mission = await tx.mission.update({ where: { id: missionId }, data: input });
    await audit(tx, adminId, "mission.update", "Mission", missionId, input);
    return mission;
  });
}

export async function listAuditLog(limit = 50) {
  return prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, action: true, targetType: true, targetId: true, details: true, createdAt: true, admin: { select: { username: true } } },
  });
}

/** Builds a lightweight odds preview (EV, RTP) for unsaved admin edits. */
export async function previewPackOdds(packId: string, odds: { rarity: RarityKey; weightPpm: number }[], pool: { cardId: string; weight: number }[]) {
  const pack = await prisma.pack.findUnique({ where: { id: packId }, select: { cardsPerPack: true, price: true } });
  if (!pack) throw notFound("Pack");
  const cards = await prisma.card.findMany({ where: { id: { in: pool.map((p) => p.cardId) } }, select: { id: true, rarity: true, currentValue: true } });
  const byId = new Map(cards.map((c) => [c.id, c]));
  const snapshot = buildPackSnapshot(
    pack.cardsPerPack,
    odds,
    pool.filter((p) => byId.has(p.cardId)).map((p) => ({ ...p, rarity: byId.get(p.cardId)!.rarity as RarityKey })),
  );
  const problems = validatePackSnapshot(snapshot);
  const values = new Map(cards.map((c) => [c.id, c.currentValue]));
  const ev = problems.length ? null : expectedPackValue(snapshot, values);
  if (!problems.length) compilePackOdds(snapshot);
  return { problems, expectedValue: ev, rtp: ev === null ? null : ev / Math.max(1, pack.price) };
}
