import type { Prisma } from "@/generated/prisma/client";
import { addUtcDays } from "@/lib/dates";
import { percentChange } from "@/lib/market-sim";
import { atLeastOnceInPack, cardSlotProbabilities, type PackOddsSnapshot } from "@/lib/probability";
import type { RarityKey } from "@/lib/rarity";
import { prisma } from "../db";
import { notFound } from "../errors";
import { PUBLIC_USER_SELECT, publicIdentity } from "./privacy";

/** Card fields every UI surface needs. */
export const CARD_VIEW_SELECT = {
  id: true,
  slug: true,
  name: true,
  pokemon: true,
  number: true,
  variant: true,
  rarity: true,
  energyType: true,
  dexNumber: true,
  imageUrl: true,
  grade: true,
  releaseYear: true,
  category: true,
  currentValue: true,
  set: { select: { id: true, name: true, code: true } },
} satisfies Prisma.CardSelect;

export type CardView = Prisma.CardGetPayload<{ select: typeof CARD_VIEW_SELECT }> & { rarity: RarityKey };

export function toCardView<T extends { rarity: string }>(card: T): T & { rarity: RarityKey } {
  return card as T & { rarity: RarityKey };
}

// ── Price changes ────────────────────────────────────────────────────────────

let changesCache: { at: number; data: Map<string, PriceChanges> } | null = null;

export interface PriceChanges {
  d1: number | null;
  d7: number | null;
  d30: number | null;
  volume7d: number;
}

async function pricesAsOf(before: Date) {
  const rows = await prisma.$queryRaw<{ cardId: string; price: number }[]>`
    SELECT DISTINCT ON ("cardId") "cardId", "price"
    FROM "CardPriceHistory"
    WHERE "recordedAt" <= ${before}
    ORDER BY "cardId", "recordedAt" DESC`;
  return new Map(rows.map((r) => [r.cardId, r.price]));
}

/** 24h / 7d / 30d changes for every card, cached for a minute. */
export async function getPriceChanges(): Promise<Map<string, PriceChanges>> {
  if (changesCache && Date.now() - changesCache.at < 60_000) return changesCache.data;
  const now = new Date();
  const [cards, p1, p7, p30, volumes] = await Promise.all([
    prisma.card.findMany({ select: { id: true, currentValue: true } }),
    pricesAsOf(addUtcDays(now, -1)),
    pricesAsOf(addUtcDays(now, -7)),
    pricesAsOf(addUtcDays(now, -30)),
    prisma.$queryRaw<{ cardId: string; v: bigint }[]>`
      SELECT "cardId", SUM("volume") AS v FROM "CardPriceHistory" WHERE "recordedAt" > ${addUtcDays(now, -7)} GROUP BY "cardId"`,
  ]);
  const vol = new Map(volumes.map((v) => [v.cardId, Number(v.v)]));
  const data = new Map<string, PriceChanges>();
  for (const c of cards) {
    data.set(c.id, {
      d1: percentChange(p1.get(c.id), c.currentValue),
      d7: percentChange(p7.get(c.id), c.currentValue),
      d30: percentChange(p30.get(c.id), c.currentValue),
      volume7d: vol.get(c.id) ?? 0,
    });
  }
  changesCache = { at: Date.now(), data };
  return data;
}

export function invalidatePriceCache() {
  changesCache = null;
}

export async function getTrendingCards(limit = 8) {
  const changes = await getPriceChanges();
  const cards = await prisma.card.findMany({ where: { isActive: true }, select: CARD_VIEW_SELECT });
  const withChange = cards
    .map((c) => ({ card: toCardView(c), change: changes.get(c.id) ?? null }))
    .filter((c) => c.change?.d1 !== null && c.change?.d1 !== undefined);
  const gainers = [...withChange].sort((a, b) => (b.change!.d1 ?? 0) - (a.change!.d1 ?? 0)).slice(0, limit);
  const losers = [...withChange].sort((a, b) => (a.change!.d1 ?? 0) - (b.change!.d1 ?? 0)).slice(0, limit);
  return { gainers, losers };
}

/** Full market index: every card with value and changes. */
export async function getMarketIndex() {
  const [changes, cards] = await Promise.all([
    getPriceChanges(),
    prisma.card.findMany({ where: { isActive: true }, select: CARD_VIEW_SELECT, orderBy: { currentValue: "desc" } }),
  ]);
  return cards.map((c) => ({ card: toCardView(c), change: changes.get(c.id) ?? null }));
}

// ── Pack availability ────────────────────────────────────────────────────────

const slotProbCache = new Map<string, Map<string, number>>();

export function slotProbabilitiesForVersion(versionId: string, snapshot: PackOddsSnapshot) {
  let probs = slotProbCache.get(versionId);
  if (!probs) {
    probs = cardSlotProbabilities(snapshot);
    if (slotProbCache.size > 200) slotProbCache.clear();
    slotProbCache.set(versionId, probs);
  }
  return probs;
}

/** Which active packs can drop this card, and with what probability. */
export async function packsContainingCard(cardId: string) {
  const packs = await prisma.pack.findMany({
    where: { isActive: true, pool: { some: { cardId } } },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      price: true,
      theme: true,
      cardsPerPack: true,
      oddsVersions: { orderBy: { version: "desc" }, take: 1, select: { id: true, data: true } },
    },
  });
  return packs
    .filter((p) => p.oddsVersions.length)
    .map((p) => {
      const version = p.oddsVersions[0];
      const snapshot = version.data as unknown as PackOddsSnapshot;
      const slot = slotProbabilitiesForVersion(version.id, snapshot).get(cardId) ?? 0;
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        theme: p.theme,
        slotProbability: slot,
        packProbability: atLeastOnceInPack(slot, snapshot.cardsPerPack),
      };
    })
    .filter((p) => p.slotProbability > 0);
}

// ── Card detail ──────────────────────────────────────────────────────────────

export async function getCardDetail(cardId: string, userId?: string | null) {
  const card = await prisma.card.findFirst({
    where: { OR: [{ id: cardId }, { slug: cardId }] },
    select: { ...CARD_VIEW_SELECT, baseValue: true, isActive: true, set: { select: { id: true, name: true, code: true, series: true, releaseYear: true } } },
  });
  if (!card) throw notFound("Card");

  const since = addUtcDays(new Date(), -90);
  const [history, changes, packs, sales, listingStats, owned, favorite, totalOwners] = await Promise.all([
    prisma.cardPriceHistory.findMany({
      where: { cardId: card.id, recordedAt: { gte: since } },
      orderBy: { recordedAt: "asc" },
      select: { price: true, volume: true, recordedAt: true },
    }),
    getPriceChanges(),
    packsContainingCard(card.id),
    prisma.marketplaceTransaction.findMany({
      where: { cardId: card.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, price: true, createdAt: true, buyer: { select: PUBLIC_USER_SELECT }, seller: { select: PUBLIC_USER_SELECT } },
    }),
    prisma.marketplaceListing.aggregate({ where: { cardId: card.id, status: "ACTIVE" }, _min: { price: true }, _count: true }),
    userId
      ? prisma.userCard.findMany({
          where: { userId, cardId: card.id },
          orderBy: { acquiredAt: "desc" },
          select: {
            id: true,
            status: true,
            source: true,
            acquiredAt: true,
            acquiredValue: true,
            listings: { where: { status: "ACTIVE" }, select: { id: true, price: true } },
          },
        })
      : Promise.resolve([]),
    userId ? prisma.favoriteCard.findUnique({ where: { userId_cardId: { userId, cardId: card.id } } }) : Promise.resolve(null),
    prisma.userCard.findMany({ where: { cardId: card.id }, distinct: ["userId"], select: { userId: true } }),
  ]);

  return {
    card: toCardView(card),
    baseValue: card.baseValue,
    isActive: card.isActive,
    history: history.map((h) => ({ price: h.price, volume: h.volume, t: h.recordedAt.toISOString() })),
    change: changes.get(card.id) ?? null,
    packs,
    sales: sales.map((s) => ({ ...s, buyer: publicIdentity(s.buyer, userId), seller: publicIdentity(s.seller, userId) })),
    lowestListing: listingStats._min.price,
    activeListings: listingStats._count,
    owned: owned.map((o) => ({ ...o, listing: o.listings[0] ?? null })),
    isFavorite: Boolean(favorite),
    owners: totalOwners.length,
  };
}

export type CardDetail = Awaited<ReturnType<typeof getCardDetail>>;
