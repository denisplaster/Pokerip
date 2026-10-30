import { RARITIES, type RarityKey } from "@/lib/rarity";
import { prisma, withTransaction } from "../db";
import { AppError, badRequest, conflict } from "../errors";
import { CARD_VIEW_SELECT, toCardView, type CardView } from "./cards";
import { completedSetIds, trackEarnings, trackMission, type Notices } from "./progression";
import { getSettings } from "./settings";
import { applyWalletChange } from "./wallet";

export interface CollectionEntry {
  card: CardView;
  quantity: number;
  listed: number;
  isFavorite: boolean;
  lastAcquiredAt: string;
}

export async function getCollection(userId: string) {
  const [groups, favorites, cards, sets] = await Promise.all([
    prisma.userCard.groupBy({
      by: ["cardId", "status"],
      where: { userId },
      _count: true,
      _max: { acquiredAt: true },
    }),
    prisma.favoriteCard.findMany({ where: { userId }, select: { cardId: true } }),
    prisma.card.findMany({ where: { isActive: true }, select: { id: true, setId: true, rarity: true } }),
    prisma.cardSet.findMany({ orderBy: [{ releaseYear: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true, series: true, releaseYear: true } }),
  ]);

  const byCard = new Map<string, { quantity: number; listed: number; last: Date }>();
  for (const g of groups) {
    const entry = byCard.get(g.cardId) ?? { quantity: 0, listed: 0, last: new Date(0) };
    entry.quantity += g._count;
    if (g.status === "LISTED") entry.listed += g._count;
    if (g._max.acquiredAt && g._max.acquiredAt > entry.last) entry.last = g._max.acquiredAt;
    byCard.set(g.cardId, entry);
  }
  const ownedCards = await prisma.card.findMany({ where: { id: { in: [...byCard.keys()] } }, select: CARD_VIEW_SELECT });
  const favSet = new Set(favorites.map((f) => f.cardId));

  const entries: CollectionEntry[] = ownedCards.map((c) => {
    const e = byCard.get(c.id)!;
    return { card: toCardView(c), quantity: e.quantity, listed: e.listed, isFavorite: favSet.has(c.id), lastAcquiredAt: e.last.toISOString() };
  });

  const totalCards = entries.reduce((n, e) => n + e.quantity, 0);
  const totalValue = entries.reduce((n, e) => n + e.quantity * e.card.currentValue, 0);
  const mostValuable = entries.reduce<CollectionEntry | null>((best, e) => (!best || e.card.currentValue > best.card.currentValue ? e : best), null);
  const rarityDistribution = RARITIES.map((r) => ({
    rarity: r as RarityKey,
    copies: entries.filter((e) => e.card.rarity === r).reduce((n, e) => n + e.quantity, 0),
    unique: entries.filter((e) => e.card.rarity === r).length,
    total: cards.filter((c) => c.rarity === r).length,
  }));
  const ownedIds = new Set(entries.map((e) => e.card.id));
  const setProgress = sets
    .map((s) => {
      const setCards = cards.filter((c) => c.setId === s.id);
      const owned = setCards.filter((c) => ownedIds.has(c.id)).length;
      return { ...s, owned, total: setCards.length, complete: setCards.length > 0 && owned === setCards.length };
    })
    .filter((s) => s.total > 0);

  return {
    entries,
    stats: {
      totalCards,
      uniqueCards: entries.length,
      catalogSize: cards.length,
      completion: cards.length ? ownedIds.size / cards.length : 0,
      totalValue,
      mostValuable: mostValuable ? { card: mostValuable.card, quantity: mostValuable.quantity } : null,
      duplicates: entries.reduce((n, e) => n + Math.max(0, e.quantity - 1), 0),
      setsCompleted: setProgress.filter((s) => s.complete).length,
    },
    rarityDistribution,
    setProgress,
  };
}

export type CollectionData = Awaited<ReturnType<typeof getCollection>>;

export async function getRecentPulls(userId: string, limit = 12) {
  const rows = await prisma.packOpeningReward.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { slot: "asc" }],
    take: limit,
    select: { id: true, value: true, createdAt: true, card: { select: CARD_VIEW_SELECT }, opening: { select: { pack: { select: { name: true } } } } },
  });
  return rows.map((r) => ({ id: r.id, value: r.value, createdAt: r.createdAt.toISOString(), packName: r.opening.pack.name, card: toCardView(r.card) }));
}

export async function getCopies(userId: string, cardId: string) {
  return prisma.userCard.findMany({
    where: { userId, cardId },
    orderBy: { acquiredAt: "desc" },
    select: { id: true, status: true, source: true, acquiredAt: true, acquiredValue: true },
  });
}

export async function setFavorite(userId: string, cardId: string, favorite: boolean) {
  if (favorite) {
    const owns = await prisma.userCard.findFirst({ where: { userId, cardId }, select: { id: true } });
    if (!owns) throw badRequest("You can only favourite cards you own.");
    await prisma.favoriteCard.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: { userId, cardId },
      update: {},
    });
  } else {
    await prisma.favoriteCard.deleteMany({ where: { userId, cardId } });
  }
  return { cardId, favorite };
}

export function instantSellPrice(value: number, bps: number) {
  return Math.max(1, Math.floor((value * bps) / 10_000));
}

/** Sells specific owned copies back to the platform at the configured instant-sell rate. */
export async function sellCards(userId: string, userCardIds: string[]) {
  const ids = [...new Set(userCardIds)];
  if (!ids.length) throw badRequest("Select at least one card to sell.");
  return withTransaction(async (tx) => {
    const notices: Notices = [];
    const { economy } = await getSettings(tx);
    // Lock the wallet first (global lock order), then the copies being sold.
    await tx.$queryRaw`SELECT 1 FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
    const rows = await tx.$queryRaw<{ id: string; cardId: string; status: string }[]>`
      SELECT "id", "cardId", "status" FROM "UserCard"
      WHERE "id" = ANY(${ids}::text[]) AND "userId" = ${userId}
      FOR UPDATE`;
    if (rows.length !== ids.length) throw new AppError("NOT_FOUND", "Some of those cards are no longer in your collection.");
    if (rows.some((r) => r.status !== "OWNED")) throw conflict("Cancel the marketplace listing before selling that card.");

    const cardIds = [...new Set(rows.map((r) => r.cardId))];
    const cards = await tx.card.findMany({ where: { id: { in: cardIds } }, select: { id: true, name: true, currentValue: true } });
    const byId = new Map(cards.map((c) => [c.id, c]));
    const before = await tx.userCard.groupBy({ by: ["cardId"], where: { userId, cardId: { in: cardIds } }, _count: true });
    const countBefore = new Map(before.map((b) => [b.cardId, b._count]));

    const soldPerCard = new Map<string, number>();
    let total = 0;
    const lines = rows.map((r) => {
      const card = byId.get(r.cardId)!;
      const payout = instantSellPrice(card.currentValue, economy.instantSellBps);
      total += payout;
      soldPerCard.set(r.cardId, (soldPerCard.get(r.cardId) ?? 0) + 1);
      return { userCardId: r.id, cardId: r.cardId, value: card.currentValue, payout };
    });
    let duplicatesSold = 0;
    for (const [cardId, sold] of soldPerCard) duplicatesSold += Math.min(sold, Math.max(0, (countBefore.get(cardId) ?? 0) - 1));

    await tx.userCard.deleteMany({ where: { id: { in: ids }, userId } });
    const single = lines.length === 1 ? byId.get(lines[0].cardId)! : null;
    const { balance } = await applyWalletChange(tx, {
      userId,
      amount: total,
      type: "CARD_SALE",
      description: single ? `Instant sale: ${single.name}` : `Instant sale: ${lines.length} cards`,
      cardId: single?.id,
      metadata: { rateBps: economy.instantSellBps, cards: lines.slice(0, 200) },
    });
    if (duplicatesSold > 0) await trackMission(tx, userId, "SELL_DUPLICATE", duplicatesSold, notices);
    await trackEarnings(tx, userId, total, notices);
    // Favourites only make sense for cards still owned.
    const remaining = await tx.userCard.findMany({ where: { userId, cardId: { in: cardIds } }, distinct: ["cardId"], select: { cardId: true } });
    const stillOwned = new Set(remaining.map((r) => r.cardId));
    const gone = cardIds.filter((id) => !stillOwned.has(id));
    if (gone.length) await tx.favoriteCard.deleteMany({ where: { userId, cardId: { in: gone } } });

    return { sold: lines.length, total, balance, duplicatesSold, notices };
  });
}

/** Sells every copy beyond `keep` for cards of the selected rarities (never touches listed copies). */
export async function sellDuplicates(userId: string, rarities: RarityKey[], keep = 1) {
  const copies = await prisma.userCard.findMany({
    where: { userId, status: "OWNED", card: { rarity: { in: rarities } } },
    orderBy: [{ acquiredAt: "asc" }],
    select: { id: true, cardId: true },
  });
  const listed = await prisma.userCard.groupBy({ by: ["cardId"], where: { userId, status: "LISTED" }, _count: true });
  const listedCount = new Map(listed.map((l) => [l.cardId, l._count]));
  const seen = new Map<string, number>();
  const toSell: string[] = [];
  for (const c of copies) {
    // Listed copies count towards the copies kept.
    const kept = (seen.get(c.cardId) ?? 0) + (listedCount.get(c.cardId) ?? 0);
    if (kept < keep) seen.set(c.cardId, (seen.get(c.cardId) ?? 0) + 1);
    else toSell.push(c.id);
  }
  if (!toSell.length) return { sold: 0, total: 0, balance: null, duplicatesSold: 0, notices: [] as Notices };
  // One transaction: either every selected duplicate is sold, or none are.
  return sellCards(userId, toSell);
}

export async function getFavorites(userId: string, limit = 12) {
  const favs = await prisma.favoriteCard.findMany({
    where: { userId, card: { owned: { some: { userId } } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { card: { select: CARD_VIEW_SELECT } },
  });
  return favs.map((f) => toCardView(f.card));
}

export async function getCompletedSetCount(userId: string) {
  return (await completedSetIds(prisma as never, userId)).length;
}
