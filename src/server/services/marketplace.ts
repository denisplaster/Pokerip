/**
 * Player-to-player marketplace using Rip Coins only.
 *
 * Safety properties (enforced with row locks + state checks inside transactions,
 * and backed by a partial unique index on active listings):
 *  - you cannot list a card you don't own, or the same copy twice;
 *  - you cannot buy your own listing;
 *  - a listing can be sold at most once (the second buyer gets a clear error);
 *  - balances can never go negative.
 */
import type { Prisma } from "@/generated/prisma/client";
import { MAX_ACTIVE_LISTINGS } from "@/lib/constants";
import type { RarityKey } from "@/lib/rarity";
import { prisma, withTransaction } from "../db";
import { AppError, badRequest, conflict, forbidden, notFound } from "../errors";
import { recordActivity } from "./activity";
import { CARD_VIEW_SELECT, toCardView } from "./cards";
import { afterCardsAcquired, checkAchievements, ownedCardIds, trackEarnings, trackMission, type Notices } from "./progression";
import { PUBLIC_USER_SELECT, publicIdentity } from "./privacy";
import { getSettings } from "./settings";
import { applyWalletChange, lockWallets } from "./wallet";

const LISTING_SELECT = {
  id: true,
  price: true,
  status: true,
  createdAt: true,
  soldAt: true,
  cancelledAt: true,
  sellerId: true,
  seller: { select: PUBLIC_USER_SELECT },
  card: { select: CARD_VIEW_SELECT },
} satisfies Prisma.MarketplaceListingSelect;

function toListing(l: Prisma.MarketplaceListingGetPayload<{ select: typeof LISTING_SELECT }>) {
  return {
    id: l.id,
    price: l.price,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
    soldAt: l.soldAt?.toISOString() ?? null,
    sellerId: l.sellerId,
    seller: publicIdentity(l.seller),
    card: toCardView(l.card),
    /** Price relative to the card's current virtual value (1 = at value). */
    valueRatio: l.card.currentValue > 0 ? l.price / l.card.currentValue : null,
  };
}

export type ListingView = ReturnType<typeof toListing>;

export async function searchListings(query: {
  q?: string;
  rarity?: RarityKey;
  set?: string;
  sort: "newest" | "price_asc" | "price_desc" | "value_ratio";
  cardId?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.MarketplaceListingWhereInput = {
    status: "ACTIVE",
    ...(query.cardId ? { cardId: query.cardId } : {}),
    card: {
      ...(query.rarity ? { rarity: query.rarity } : {}),
      ...(query.set ? { set: { code: query.set } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { pokemon: { contains: query.q, mode: "insensitive" } },
              { set: { name: { contains: query.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
  };
  const skip = (query.page - 1) * query.limit;

  if (query.sort === "value_ratio") {
    // Best deals first: needs a computed ordering, so filter ids in SQL then sort.
    const all = await prisma.marketplaceListing.findMany({ where, select: { id: true, price: true, card: { select: { currentValue: true } } } });
    all.sort((a, b) => a.price / a.card.currentValue - b.price / b.card.currentValue);
    const pageIds = all.slice(skip, skip + query.limit).map((l) => l.id);
    const rows = await prisma.marketplaceListing.findMany({ where: { id: { in: pageIds } }, select: LISTING_SELECT });
    const order = new Map(pageIds.map((id, i) => [id, i]));
    rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    return { items: rows.map(toListing), total: all.length, page: query.page, pages: Math.max(1, Math.ceil(all.length / query.limit)) };
  }

  const orderBy: Prisma.MarketplaceListingOrderByWithRelationInput[] =
    query.sort === "price_asc" ? [{ price: "asc" }, { id: "asc" }] : query.sort === "price_desc" ? [{ price: "desc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "asc" }];
  const [rows, total] = await Promise.all([
    prisma.marketplaceListing.findMany({ where, orderBy, skip, take: query.limit, select: LISTING_SELECT }),
    prisma.marketplaceListing.count({ where }),
  ]);
  return { items: rows.map(toListing), total, page: query.page, pages: Math.max(1, Math.ceil(total / query.limit)) };
}

export async function getMyListings(userId: string) {
  const [active, recent] = await Promise.all([
    prisma.marketplaceListing.findMany({ where: { sellerId: userId, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, select: LISTING_SELECT }),
    prisma.marketplaceListing.findMany({
      where: { sellerId: userId, status: { in: ["SOLD", "CANCELLED"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: LISTING_SELECT,
    }),
  ]);
  return { active: active.map(toListing), recent: recent.map(toListing) };
}

export async function getSaleHistory(opts: { userId?: string; cardId?: string; limit?: number; viewerId?: string | null } = {}) {
  const rows = await prisma.marketplaceTransaction.findMany({
    where: {
      ...(opts.cardId ? { cardId: opts.cardId } : {}),
      ...(opts.userId ? { OR: [{ buyerId: opts.userId }, { sellerId: opts.userId }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, opts.limit ?? 30),
    select: {
      id: true,
      price: true,
      fee: true,
      sellerProceeds: true,
      createdAt: true,
      buyerId: true,
      sellerId: true,
      buyer: { select: PUBLIC_USER_SELECT },
      seller: { select: PUBLIC_USER_SELECT },
      card: { select: CARD_VIEW_SELECT },
    },
  });
  return rows.map((r) => ({
    ...r,
    buyer: publicIdentity(r.buyer, opts.viewerId),
    seller: publicIdentity(r.seller, opts.viewerId),
    createdAt: r.createdAt.toISOString(),
    card: toCardView(r.card),
  }));
}

export async function createListing(userId: string, userCardId: string, price: number) {
  return withTransaction(async (tx) => {
    const notices: Notices = [];
    await lockWallets(tx, [userId]);
    const [copy] = await tx.$queryRaw<{ id: string; cardId: string; status: string }[]>`
      SELECT "id", "cardId", "status" FROM "UserCard" WHERE "id" = ${userCardId} AND "userId" = ${userId} FOR UPDATE`;
    if (!copy) throw notFound("Card copy");
    if (copy.status !== "OWNED") throw conflict("That card is already listed.");
    const active = await tx.marketplaceListing.count({ where: { sellerId: userId, status: "ACTIVE" } });
    if (active >= MAX_ACTIVE_LISTINGS) throw badRequest(`You can have at most ${MAX_ACTIVE_LISTINGS} active listings.`);

    await tx.userCard.update({ where: { id: copy.id }, data: { status: "LISTED" } });
    const listing = await tx.marketplaceListing.create({
      data: { sellerId: userId, userCardId: copy.id, cardId: copy.cardId, price },
      select: LISTING_SELECT,
    });
    await trackMission(tx, userId, "LIST_ON_MARKETPLACE", 1, notices);
    return { listing: toListing(listing), notices };
  });
}

export async function cancelListing(userId: string, listingId: string, opts: { asAdmin?: boolean } = {}) {
  return withTransaction(async (tx) => {
    const [listing] = await tx.$queryRaw<{ id: string; sellerId: string; status: string; userCardId: string | null }[]>`
      SELECT "id", "sellerId", "status", "userCardId" FROM "MarketplaceListing" WHERE "id" = ${listingId} FOR UPDATE`;
    if (!listing) throw notFound("Listing");
    if (listing.sellerId !== userId && !opts.asAdmin) throw forbidden("You can only cancel your own listings.");
    if (listing.status !== "ACTIVE") throw conflict("This listing is no longer active.");
    await tx.marketplaceListing.update({ where: { id: listing.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    if (listing.userCardId) await tx.userCard.update({ where: { id: listing.userCardId }, data: { status: "OWNED" } });
    return { id: listing.id, status: "CANCELLED" as const };
  });
}

export async function buyListing(buyerId: string, listingId: string) {
  return withTransaction(async (tx) => {
    const notices: Notices = [];
    const [listing] = await tx.$queryRaw<{ id: string; sellerId: string; status: string; userCardId: string | null; cardId: string; price: number }[]>`
      SELECT "id", "sellerId", "status", "userCardId", "cardId", "price" FROM "MarketplaceListing" WHERE "id" = ${listingId}`;
    if (!listing) throw notFound("Listing");
    if (listing.sellerId === buyerId) throw badRequest("You can't buy your own listing.");

    // Lock both wallets in a deterministic order, then the listing itself.
    await lockWallets(tx, [buyerId, listing.sellerId]);
    const [locked] = await tx.$queryRaw<{ status: string; userCardId: string | null; price: number }[]>`
      SELECT "status", "userCardId", "price" FROM "MarketplaceListing" WHERE "id" = ${listingId} FOR UPDATE`;
    if (!locked || locked.status !== "ACTIVE" || !locked.userCardId) throw new AppError("UNAVAILABLE", "Sorry — this listing was just sold or cancelled.");

    const { economy } = await getSettings(tx);
    const price = locked.price;
    const fee = Math.floor((price * economy.marketplaceFeeBps) / 10_000);
    const proceeds = price - fee;
    const card = await tx.card.findUniqueOrThrow({ where: { id: listing.cardId }, select: { id: true, name: true, rarity: true, currentValue: true } });
    const previouslyOwned = await ownedCardIds(tx, buyerId, [card.id]);

    const { balance } = await applyWalletChange(tx, {
      userId: buyerId,
      amount: -price,
      type: "MARKETPLACE_PURCHASE",
      description: `Bought ${card.name} on the marketplace`,
      idempotencyKey: `market-buy:${listingId}`,
      cardId: card.id,
      listingId,
    });
    await applyWalletChange(tx, {
      userId: listing.sellerId,
      amount: proceeds,
      type: "MARKETPLACE_SALE",
      description: `Sold ${card.name} on the marketplace`,
      idempotencyKey: `market-sale:${listingId}`,
      cardId: card.id,
      listingId,
      metadata: { price, fee },
    });

    await tx.userCard.update({
      where: { id: locked.userCardId },
      data: { userId: buyerId, status: "OWNED", source: "MARKETPLACE", acquiredValue: price, acquiredAt: new Date() },
    });
    await tx.marketplaceListing.update({ where: { id: listingId }, data: { status: "SOLD", buyerId, soldAt: new Date() } });
    const sale = await tx.marketplaceTransaction.create({
      data: { listingId, buyerId, sellerId: listing.sellerId, cardId: card.id, price, fee, sellerProceeds: proceeds },
    });

    // The seller may no longer own the card; drop a stale favourite.
    const sellerStillOwns = await tx.userCard.findFirst({ where: { userId: listing.sellerId, cardId: card.id }, select: { id: true } });
    if (!sellerStillOwns) await tx.favoriteCard.deleteMany({ where: { userId: listing.sellerId, cardId: card.id } });

    if (price >= 2_500) {
      await recordActivity(tx, {
        type: "MARKETPLACE_SALE",
        userId: buyerId,
        cardId: card.id,
        rarity: card.rarity as RarityKey,
        value: price,
        message: `bought ${card.name} on the marketplace`,
      });
    }

    await afterCardsAcquired(tx, buyerId, [card.id], previouslyOwned, notices);
    // Seller-side progress is tracked but its notices belong to the seller, not this response.
    const sellerNotices: Notices = [];
    await trackEarnings(tx, listing.sellerId, proceeds, sellerNotices);
    await checkAchievements(tx, listing.sellerId, ["MARKET_SALES", "COLLECTION_VALUE"], sellerNotices);

    return { saleId: sale.id, price, fee, balance, notices };
  });
}
