/**
 * Pack shop & pack opening.
 *
 * Opening flow (all-or-nothing):
 *   1. Outcomes are drawn on the server with a CSPRNG from the latest published
 *      odds version — before payment and without any knowledge of the user.
 *   2. In one transaction: lock wallet → debit (or redeem voucher) → create
 *      openings, rewards and owned cards → progression → commit.
 *   3. The client only receives results after the commit; the animation is
 *      purely cosmetic.
 * Repeating a request with the same idempotency key returns the original result.
 */
import { randomUUID } from "node:crypto";
import { xpForPack } from "@/lib/levels";
import {
  compilePackOdds,
  drawPack,
  expectedPackValue,
  packValueRange,
  resolveDraw,
  type Draw,
  type PackOddsSnapshot,
} from "@/lib/probability";
import { rarityRank, type RarityKey } from "@/lib/rarity";
import { cryptoRng } from "../crypto-rng";
import { isUniqueViolation, prisma, withTransaction } from "../db";
import { AppError, badRequest, notFound, unavailable } from "../errors";
import { recordActivity } from "./activity";
import { CARD_VIEW_SELECT, slotProbabilitiesForVersion, toCardView, type CardView } from "./cards";
import { getLatestPackOdds } from "./odds";
import { afterCardsAcquired, grantXp, ownedCardIds, trackMission, type Notices } from "./progression";
import { getSettings } from "./settings";
import { applyWalletChange, lockWallets } from "./wallet";

const PACK_SELECT = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  description: true,
  price: true,
  cardsPerPack: true,
  theme: true,
  featured: true,
  isActive: true,
  sortOrder: true,
  updatedAt: true,
} as const;

export interface PackSummary {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  cardsPerPack: number;
  theme: string;
  featured: boolean;
  isActive: boolean;
  odds: { rarity: RarityKey; weightPpm: number; cards: number }[];
  poolSize: number;
  expectedValue: number;
  valueRange: { min: number; max: number };
  chaseCards: CardView[];
  oddsVersion: number;
  oddsUpdatedAt: string;
}

async function cardValues(ids?: string[]) {
  const rows = await prisma.card.findMany({
    where: ids ? { id: { in: ids } } : undefined,
    select: { id: true, currentValue: true },
  });
  return new Map(rows.map((r) => [r.id, r.currentValue]));
}

function summarise(
  pack: { id: string; slug: string; name: string; tagline: string; description: string; price: number; cardsPerPack: number; theme: string; featured: boolean; isActive: boolean },
  version: { version: number; createdAt: Date; data: unknown },
  values: Map<string, number>,
  chaseCards: CardView[],
): PackSummary {
  const snapshot = version.data as PackOddsSnapshot;
  return {
    ...pack,
    odds: snapshot.tiers.map((t) => ({ rarity: t.rarity, weightPpm: t.weightPpm, cards: t.cards.length })),
    poolSize: snapshot.tiers.reduce((n, t) => n + (t.weightPpm > 0 ? t.cards.length : 0), 0),
    expectedValue: Math.round(expectedPackValue(snapshot, values)),
    valueRange: packValueRange(snapshot, values),
    chaseCards,
    oddsVersion: version.version,
    oddsUpdatedAt: version.createdAt.toISOString(),
  };
}

export async function listPacks(opts: { includeInactive?: boolean } = {}): Promise<PackSummary[]> {
  const packs = await prisma.pack.findMany({
    where: opts.includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    select: { ...PACK_SELECT, oddsVersions: { orderBy: { version: "desc" }, take: 1 } },
  });
  const values = await cardValues();
  const allCards = await prisma.card.findMany({ select: CARD_VIEW_SELECT });
  const byId = new Map(allCards.map((c) => [c.id, toCardView(c)]));
  return packs
    .filter((p) => p.oddsVersions.length)
    .map((p) => {
      const version = p.oddsVersions[0];
      const snapshot = version.data as unknown as PackOddsSnapshot;
      const eligible = snapshot.tiers.filter((t) => t.weightPpm > 0).flatMap((t) => t.cards.map((c) => c.cardId));
      const chase = eligible
        .map((id) => byId.get(id))
        .filter((c): c is CardView => Boolean(c))
        .sort((a, b) => b.currentValue - a.currentValue)
        .slice(0, 3);
      const { oddsVersions: _v, sortOrder: _s, updatedAt: _u, ...pack } = p;
      return summarise(pack, version, values, chase);
    });
}

export async function getPackDetail(idOrSlug: string) {
  const pack = await prisma.pack.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: PACK_SELECT,
  });
  if (!pack) throw notFound("Pack");
  const { version } = await getLatestPackOdds(pack.id);
  const snapshot = version.data as unknown as PackOddsSnapshot;
  const ids = snapshot.tiers.flatMap((t) => t.cards.map((c) => c.cardId));
  const cards = await prisma.card.findMany({ where: { id: { in: ids } }, select: CARD_VIEW_SELECT });
  const values = new Map(cards.map((c) => [c.id, c.currentValue]));
  const slot = slotProbabilitiesForVersion(version.id, snapshot);
  const cardRows = cards
    .map((c) => ({ card: toCardView(c), slotProbability: slot.get(c.id) ?? 0 }))
    .filter((c) => c.slotProbability > 0)
    .sort((a, b) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity) || b.card.currentValue - a.card.currentValue);
  const chase = cardRows.slice(0, 6).map((c) => c.card);
  const history = await prisma.oddsVersion.findMany({
    where: { packId: pack.id },
    orderBy: { version: "desc" },
    take: 10,
    select: { version: true, hash: true, createdAt: true },
  });
  const { sortOrder: _s, updatedAt: _u, ...rest } = pack;
  return {
    pack: summarise(rest, version, values, chase),
    cards: cardRows,
    oddsHash: version.hash,
    history: history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
  };
}

// ── Opening ──────────────────────────────────────────────────────────────────

export interface PulledCard {
  rewardId: string;
  userCardId: string | null;
  slot: number;
  rarity: RarityKey;
  value: number;
  isNew: boolean;
  card: CardView;
}

export interface OpenResult {
  batchId: string;
  replayed: boolean;
  pack: { id: string; slug: string; name: string; price: number; theme: string; cardsPerPack: number };
  packs: { openingId: string; totalValue: number; cards: PulledCard[] }[];
  totalValue: number;
  totalPaid: number;
  usedVoucher: boolean;
  balance: number;
  oddsVersion: number;
  notices: Notices;
}

export async function countVouchers(userId: string) {
  const rows = await prisma.packVoucher.groupBy({
    by: ["packId"],
    where: { userId, redeemedAt: null },
    _count: true,
  });
  return Object.fromEntries(rows.map((r) => [r.packId, r._count]));
}

async function loadBatch(userId: string, batchId: string): Promise<OpenResult | null> {
  const openings = await prisma.packOpening.findMany({
    where: { userId, batchId },
    orderBy: { idempotencyKey: "asc" },
    include: {
      pack: { select: { id: true, slug: true, name: true, price: true, theme: true, cardsPerPack: true } },
      oddsVersion: { select: { version: true } },
      voucher: { select: { id: true } },
      rewards: { orderBy: { slot: "asc" }, include: { card: { select: CARD_VIEW_SELECT } } },
    },
  });
  if (!openings.length) return null;
  const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
  return {
    batchId,
    replayed: true,
    pack: openings[0].pack,
    packs: openings.map((o) => ({
      openingId: o.id,
      totalValue: o.totalValue,
      cards: o.rewards.map((r) => ({
        rewardId: r.id,
        userCardId: r.userCardId,
        slot: r.slot,
        rarity: r.rarity as RarityKey,
        value: r.value,
        isNew: false,
        card: toCardView(r.card),
      })),
    })),
    totalValue: openings.reduce((s, o) => s + o.totalValue, 0),
    totalPaid: openings.reduce((s, o) => s + o.pricePaid, 0),
    usedVoucher: openings.some((o) => o.voucher),
    balance: wallet?.balance ?? 0,
    oddsVersion: openings[0].oddsVersion.version,
    notices: [],
  };
}

export function isBigPull(rarity: RarityKey, value: number, minRarity: RarityKey, minValue: number) {
  return rarityRank(rarity) >= rarityRank(minRarity) && (value >= minValue || rarity === "CHASE");
}

export async function openPacks(input: {
  userId: string;
  pack: string;
  quantity: 1 | 5 | 10;
  idempotencyKey: string;
  useVoucher?: boolean;
}): Promise<OpenResult> {
  const { userId, quantity, idempotencyKey } = input;
  const pack = await prisma.pack.findFirst({ where: { OR: [{ id: input.pack }, { slug: input.pack }] } });
  if (!pack) throw notFound("Pack");
  const batchId = `${userId}:${idempotencyKey}`;

  const existing = await loadBatch(userId, batchId);
  if (existing) {
    if (existing.pack.id !== pack.id) throw badRequest("Idempotency key was already used for a different pack.");
    return existing;
  }
  if (!pack.isActive) throw unavailable("This pack is not currently available.");
  if (input.useVoucher && quantity !== 1) throw badRequest("Vouchers open one pack at a time.");

  const { version, compiled } = await getLatestPackOdds(pack.id);
  // Outcomes are fixed here, server-side, before any payment or animation.
  const draws: Draw[][] = Array.from({ length: quantity }, () => drawPack(compiled, cryptoRng));
  const drawnIds = [...new Set(draws.flat().map((d) => d.cardId))];

  try {
    return await withTransaction(async (tx) => {
      const notices: Notices = [];
      const settings = await getSettings(tx);
      let voucherId: string | null = null;
      const totalPaid = input.useVoucher ? 0 : pack.price * quantity;

      if (input.useVoucher) {
        await lockWallets(tx, [userId]);
        const [voucher] = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "PackVoucher"
          WHERE "userId" = ${userId} AND "packId" = ${pack.id} AND "redeemedAt" IS NULL
          ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE`;
        if (!voucher) throw new AppError("NOT_FOUND", "You don't have a free-pack voucher for this pack.");
        voucherId = voucher.id;
      } else if (totalPaid > 0) {
        await applyWalletChange(tx, {
          userId,
          amount: -totalPaid,
          type: "PACK_PURCHASE",
          description: `${quantity > 1 ? `${quantity}× ` : ""}${pack.name}`,
          idempotencyKey: `pack:${batchId}`,
          packId: pack.id,
          packOpeningBatchId: batchId,
          metadata: { quantity, unitPrice: pack.price, oddsVersion: version.version },
        });
      } else {
        await lockWallets(tx, [userId]);
      }

      // Values are read inside the transaction so they match what gets recorded.
      const cardRows = await tx.card.findMany({ where: { id: { in: drawnIds } }, select: CARD_VIEW_SELECT });
      const cards = new Map(cardRows.map((c) => [c.id, toCardView(c)]));
      const previouslyOwned = await ownedCardIds(tx, userId, drawnIds);
      const seenThisBatch = new Set<string>();

      const result: OpenResult["packs"] = [];
      for (let i = 0; i < quantity; i++) {
        const packDraws = draws[i];
        const totalValue = packDraws.reduce((s, d) => s + cards.get(d.cardId)!.currentValue, 0);
        const opening = await tx.packOpening.create({
          data: {
            userId,
            packId: pack.id,
            oddsVersionId: version.id,
            batchId,
            idempotencyKey: `${idempotencyKey}:${String(i).padStart(2, "0")}`,
            pricePaid: input.useVoucher ? 0 : pack.price,
            totalValue,
          },
        });
        const rows = packDraws.map((d, slot) => {
          const card = cards.get(d.cardId)!;
          const isNew = !previouslyOwned.has(d.cardId) && !seenThisBatch.has(d.cardId);
          seenThisBatch.add(d.cardId);
          return { draw: d, slot, card, userCardId: randomUUID(), rewardId: randomUUID(), isNew };
        });
        await tx.userCard.createMany({
          data: rows.map((r) => ({ id: r.userCardId, userId, cardId: r.card.id, source: "PACK" as const, acquiredValue: r.card.currentValue })),
        });
        await tx.packOpeningReward.createMany({
          data: rows.map((r) => ({
            id: r.rewardId,
            openingId: opening.id,
            userId,
            cardId: r.card.id,
            userCardId: r.userCardId,
            slot: r.slot,
            rarity: r.draw.rarity,
            value: r.card.currentValue,
            rarityRoll: r.draw.rarityRoll,
            cardRoll: r.draw.cardRoll,
          })),
        });
        for (const r of rows) {
          if (isBigPull(r.card.rarity, r.card.currentValue, settings.activity.bigPullMinRarity, settings.activity.bigPullMinValue)) {
            await recordActivity(tx, {
              type: "BIG_PULL",
              userId,
              cardId: r.card.id,
              rarity: r.card.rarity,
              value: r.card.currentValue,
              message: `pulled ${r.card.name}${r.card.variant ? ` (${r.card.variant})` : ""} from a ${pack.name}`,
              metadata: { packSlug: pack.slug, packName: pack.name },
            });
          }
        }
        if (voucherId && i === 0) {
          await tx.packVoucher.update({ where: { id: voucherId }, data: { redeemedAt: new Date(), openingId: opening.id } });
        }
        result.push({
          openingId: opening.id,
          totalValue,
          cards: rows.map((r) => ({
            rewardId: r.rewardId,
            userCardId: r.userCardId,
            slot: r.slot,
            rarity: r.draw.rarity,
            value: r.card.currentValue,
            isNew: r.isNew,
            card: r.card,
          })),
        });
      }

      await tx.user.update({ where: { id: userId }, data: { packsOpened: { increment: quantity } } });
      await trackMission(tx, userId, "OPEN_PACKS", quantity, notices);
      await afterCardsAcquired(tx, userId, draws.flat().map((d) => d.cardId), previouslyOwned, notices, {
        extraMetrics: ["PACKS_OPENED", "CHASE_PULLS", "SECRET_PULLS", "BIGGEST_PULL"],
      });
      await grantXp(tx, userId, xpForPack(pack.price) * quantity, notices);

      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId }, select: { balance: true } });
      return {
        batchId,
        replayed: false,
        pack: { id: pack.id, slug: pack.slug, name: pack.name, price: pack.price, theme: pack.theme, cardsPerPack: pack.cardsPerPack },
        packs: result,
        totalValue: result.reduce((s, p) => s + p.totalValue, 0),
        totalPaid,
        usedVoucher: Boolean(voucherId),
        balance: wallet.balance,
        oddsVersion: version.version,
        notices,
      };
    });
  } catch (error) {
    // A concurrent duplicate of this request committed first: return its result.
    if (isUniqueViolation(error)) {
      const replay = await loadBatch(userId, batchId);
      if (replay) return replay;
    }
    throw error;
  }
}

/** Replays a stored opening against its odds snapshot to prove the recorded cards. */
export async function verifyOpening(openingId: string) {
  const opening = await prisma.packOpening.findUnique({
    where: { id: openingId },
    include: { oddsVersion: true, rewards: { orderBy: { slot: "asc" } } },
  });
  if (!opening) throw notFound("Opening");
  const compiled = compilePackOdds(opening.oddsVersion.data as unknown as PackOddsSnapshot);
  const checks = opening.rewards.map((r) => {
    const replay = resolveDraw(compiled, r.rarityRoll, r.cardRoll);
    return { slot: r.slot, recorded: r.cardId, replayed: replay.cardId, ok: replay.cardId === r.cardId && replay.rarity === r.rarity };
  });
  return { openingId, oddsVersion: opening.oddsVersion.version, oddsHash: opening.oddsVersion.hash, valid: checks.every((c) => c.ok), checks };
}

