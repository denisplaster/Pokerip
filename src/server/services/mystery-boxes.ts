/**
 * Mystery boxes share the pack architecture: odds are versioned snapshots, the
 * outcome is drawn server-side with a CSPRNG before payment, and everything is
 * committed in one transaction with idempotency protection.
 */
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { drawWeighted, PPM } from "@/lib/probability";
import { rarityRank, type RarityKey } from "@/lib/rarity";
import { cryptoRng } from "../crypto-rng";
import { isUniqueViolation, prisma, withTransaction } from "../db";
import { notFound, unavailable } from "../errors";
import { recordActivity } from "./activity";
import { CARD_VIEW_SELECT, toCardView, type CardView } from "./cards";
import { getLatestBoxOdds } from "./odds";
import { afterCardsAcquired, grantXp, ownedCardIds, trackEarnings, trackMission, type Notices } from "./progression";
import { applyWalletChange, lockWallets } from "./wallet";

const REWARD_SELECT = {
  id: true,
  type: true,
  label: true,
  weightPpm: true,
  coins: true,
  fallbackCoins: true,
  sortOrder: true,
  pack: { select: { id: true, slug: true, name: true, price: true, theme: true } },
  collectible: { select: { id: true, slug: true, name: true, description: true, rarity: true, icon: true, value: true, maxSupply: true, mintedCount: true } },
  cards: { select: { quantity: true, card: { select: CARD_VIEW_SELECT } } },
} satisfies Prisma.MysteryBoxRewardSelect;

type RewardRow = Prisma.MysteryBoxRewardGetPayload<{ select: typeof REWARD_SELECT }>;

function rewardValue(r: RewardRow) {
  switch (r.type) {
    case "COINS":
      return r.coins ?? 0;
    case "CARD":
    case "CARD_BUNDLE":
      return r.cards.reduce((s, c) => s + c.card.currentValue * c.quantity, 0);
    case "PACK_VOUCHER":
      return r.pack?.price ?? 0;
    case "COLLECTIBLE": {
      const soldOut = r.collectible?.maxSupply != null && r.collectible.mintedCount >= r.collectible.maxSupply;
      return soldOut ? (r.fallbackCoins ?? 0) : (r.collectible?.value ?? 0);
    }
  }
}

function rewardRarity(r: RewardRow): RarityKey {
  if (r.type === "COLLECTIBLE" && r.collectible) return r.collectible.rarity as RarityKey;
  if (r.cards.length) return r.cards.map((c) => c.card.rarity as RarityKey).sort((a, b) => rarityRank(b) - rarityRank(a))[0];
  const v = rewardValue(r);
  if (v >= 10_000) return "CHASE";
  if (v >= 2_500) return "SECRET_RARE";
  if (v >= 1_000) return "ULTRA_RARE";
  if (v >= 400) return "RARE";
  if (v >= 150) return "UNCOMMON";
  return "COMMON";
}

function toRewardView(r: RewardRow) {
  return {
    id: r.id,
    type: r.type,
    label: r.label,
    weightPpm: r.weightPpm,
    probability: r.weightPpm / PPM,
    coins: r.coins,
    fallbackCoins: r.fallbackCoins,
    pack: r.pack,
    collectible: r.collectible
      ? { ...r.collectible, remaining: r.collectible.maxSupply == null ? null : Math.max(0, r.collectible.maxSupply - r.collectible.mintedCount) }
      : null,
    cards: r.cards.map((c) => ({ quantity: c.quantity, card: toCardView(c.card) })),
    value: rewardValue(r),
    rarity: rewardRarity(r),
  };
}

export type BoxRewardView = ReturnType<typeof toRewardView>;

export async function listBoxes(opts: { includeInactive?: boolean } = {}) {
  const boxes = await prisma.mysteryBox.findMany({
    where: opts.includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    include: {
      rewards: { where: { weightPpm: { gt: 0 } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: REWARD_SELECT },
      oddsVersions: { orderBy: { version: "desc" }, take: 1, select: { version: true, createdAt: true, hash: true } },
    },
  });
  return boxes.map((b) => {
    const rewards = b.rewards.map(toRewardView);
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      tagline: b.tagline,
      description: b.description,
      price: b.price,
      theme: b.theme,
      featured: b.featured,
      isActive: b.isActive,
      rewards,
      expectedValue: Math.round(rewards.reduce((s, r) => s + r.probability * r.value, 0)),
      maxValue: Math.max(0, ...rewards.map((r) => r.value)),
      oddsVersion: b.oddsVersions[0]?.version ?? 0,
      oddsUpdatedAt: b.oddsVersions[0]?.createdAt.toISOString() ?? null,
      oddsHash: b.oddsVersions[0]?.hash ?? null,
    };
  });
}

export type BoxView = Awaited<ReturnType<typeof listBoxes>>[number];

export interface BoxOpenResult {
  openingId: string;
  replayed: boolean;
  box: { id: string; slug: string; name: string; price: number; theme: string };
  reward: BoxRewardView;
  awarded: {
    coins: number;
    cards: { userCardId: string; card: CardView; isNew: boolean }[];
    voucherPack: { id: string; slug: string; name: string } | null;
    collectible: { name: string; serialNumber: number; maxSupply: number | null; icon: string; rarity: string } | null;
    usedFallback: boolean;
  };
  value: number;
  balance: number;
  notices: Notices;
}

async function loadOpening(userId: string, idempotencyKey: string): Promise<BoxOpenResult | null> {
  const opening = await prisma.mysteryBoxOpening.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    include: { box: true, reward: { select: REWARD_SELECT } },
  });
  if (!opening) return null;
  const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
  const details = (opening.details ?? {}) as Partial<BoxOpenResult["awarded"]>;
  return {
    openingId: opening.id,
    replayed: true,
    box: { id: opening.box.id, slug: opening.box.slug, name: opening.box.name, price: opening.box.price, theme: opening.box.theme },
    reward: toRewardView(opening.reward),
    awarded: { coins: 0, cards: [], voucherPack: null, collectible: null, usedFallback: opening.usedFallback, ...details },
    value: opening.valueAwarded,
    balance: wallet?.balance ?? 0,
    notices: [],
  };
}

export async function openBox(input: { userId: string; box: string; idempotencyKey: string }): Promise<BoxOpenResult> {
  const { userId, idempotencyKey } = input;
  const box = await prisma.mysteryBox.findFirst({ where: { OR: [{ id: input.box }, { slug: input.box }] } });
  if (!box) throw notFound("Mystery box");
  const existing = await loadOpening(userId, idempotencyKey);
  if (existing) return existing;
  if (!box.isActive) throw unavailable("This mystery box is not currently available.");

  const { version, snapshot } = await getLatestBoxOdds(box.id);
  const { outcome, roll } = drawWeighted(snapshot.rewards, cryptoRng);

  try {
    return await withTransaction(async (tx) => {
      const notices: Notices = [];
      if (box.price > 0) {
        await applyWalletChange(tx, {
          userId,
          amount: -box.price,
          type: "MYSTERY_BOX_PURCHASE",
          description: box.name,
          idempotencyKey: `box:${userId}:${idempotencyKey}`,
          mysteryBoxId: box.id,
          metadata: { oddsVersion: version.version },
        });
      } else {
        await lockWallets(tx, [userId]);
      }
      const reward = await tx.mysteryBoxReward.findUniqueOrThrow({ where: { id: outcome.id }, select: REWARD_SELECT });
      const openingId = randomUUID();
      const awarded: BoxOpenResult["awarded"] = { coins: 0, cards: [], voucherPack: null, collectible: null, usedFallback: false };
      let value = 0;

      if (reward.type === "COINS" && reward.coins) {
        awarded.coins = reward.coins;
      } else if ((reward.type === "CARD" || reward.type === "CARD_BUNDLE") && reward.cards.length) {
        const ids = reward.cards.map((c) => c.card.id);
        const previouslyOwned = await ownedCardIds(tx, userId, ids);
        const cards = await tx.card.findMany({ where: { id: { in: ids } }, select: CARD_VIEW_SELECT });
        const byId = new Map(cards.map((c) => [c.id, toCardView(c)]));
        const rows = reward.cards.flatMap((rc) => Array.from({ length: rc.quantity }, () => ({ id: randomUUID(), card: byId.get(rc.card.id)! })));
        await tx.userCard.createMany({
          data: rows.map((r) => ({ id: r.id, userId, cardId: r.card.id, source: "MYSTERY_BOX" as const, acquiredValue: r.card.currentValue })),
        });
        const seen = new Set<string>();
        awarded.cards = rows.map((r) => {
          const isNew = !previouslyOwned.has(r.card.id) && !seen.has(r.card.id);
          seen.add(r.card.id);
          return { userCardId: r.id, card: r.card, isNew };
        });
        value = rows.reduce((s, r) => s + r.card.currentValue, 0);
        await afterCardsAcquired(tx, userId, rows.map((r) => r.card.id), previouslyOwned, notices);
      } else if (reward.type === "PACK_VOUCHER" && reward.pack) {
        await tx.packVoucher.create({ data: { userId, packId: reward.pack.id, source: "MYSTERY_BOX" } });
        awarded.voucherPack = { id: reward.pack.id, slug: reward.pack.slug, name: reward.pack.name };
        value = reward.pack.price;
      } else if (reward.type === "COLLECTIBLE" && reward.collectible) {
        // Lock the collectible so serial numbers are unique and supply is never exceeded.
        const [c] = await tx.$queryRaw<{ mintedCount: number; maxSupply: number | null }[]>`
          SELECT "mintedCount", "maxSupply" FROM "Collectible" WHERE "id" = ${reward.collectible.id} FOR UPDATE`;
        if (c.maxSupply !== null && c.mintedCount >= c.maxSupply) {
          awarded.usedFallback = true;
          awarded.coins = reward.fallbackCoins ?? 0;
        } else {
          const serialNumber = c.mintedCount + 1;
          await tx.collectible.update({ where: { id: reward.collectible.id }, data: { mintedCount: serialNumber } });
          await tx.userCollectible.create({ data: { userId, collectibleId: reward.collectible.id, serialNumber } });
          awarded.collectible = {
            name: reward.collectible.name,
            serialNumber,
            maxSupply: c.maxSupply,
            icon: reward.collectible.icon,
            rarity: reward.collectible.rarity,
          };
          value = reward.collectible.value;
        }
      }

      if (awarded.coins > 0) {
        await applyWalletChange(tx, {
          userId,
          amount: awarded.coins,
          type: "MYSTERY_BOX_REWARD",
          description: `${box.name}: ${awarded.usedFallback ? `${reward.label} (sold out — coin fallback)` : reward.label}`,
          idempotencyKey: `box-reward:${userId}:${idempotencyKey}`,
          mysteryBoxId: box.id,
          mysteryBoxOpeningId: openingId,
        });
        await trackEarnings(tx, userId, awarded.coins, notices);
        value += awarded.coins;
      }

      await tx.mysteryBoxOpening.create({
        data: {
          id: openingId,
          userId,
          boxId: box.id,
          rewardId: reward.id,
          oddsVersionId: version.id,
          idempotencyKey,
          pricePaid: box.price,
          roll,
          valueAwarded: value,
          usedFallback: awarded.usedFallback,
          details: awarded as unknown as object,
        },
      });
      await tx.user.update({ where: { id: userId }, data: { boxesOpened: { increment: 1 } } });
      await trackMission(tx, userId, "OPEN_MYSTERY_BOX", 1, notices);
      await grantXp(tx, userId, 15 + Math.floor(Math.sqrt(box.price)), notices);

      const view = toRewardView(reward);
      if (value >= Math.max(box.price * 2, 2_500)) {
        await recordActivity(tx, {
          type: "MYSTERY_BOX_WIN",
          userId,
          cardId: awarded.cards[0]?.card.id,
          rarity: view.rarity,
          value,
          message: `won ${reward.label} from a ${box.name}`,
          metadata: { boxSlug: box.slug },
        });
      }
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId }, select: { balance: true } });
      return {
        openingId,
        replayed: false,
        box: { id: box.id, slug: box.slug, name: box.name, price: box.price, theme: box.theme },
        reward: view,
        awarded,
        value,
        balance: wallet.balance,
        notices,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const replay = await loadOpening(userId, idempotencyKey);
      if (replay) return replay;
    }
    throw error;
  }
}

export async function getUserCollectibles(userId: string) {
  const rows = await prisma.userCollectible.findMany({
    where: { userId },
    orderBy: { acquiredAt: "desc" },
    include: { collectible: true },
  });
  return rows.map((r) => ({
    id: r.id,
    serialNumber: r.serialNumber,
    acquiredAt: r.acquiredAt.toISOString(),
    name: r.collectible.name,
    description: r.collectible.description,
    rarity: r.collectible.rarity as RarityKey,
    icon: r.collectible.icon,
    value: r.collectible.value,
    maxSupply: r.collectible.maxSupply,
  }));
}
