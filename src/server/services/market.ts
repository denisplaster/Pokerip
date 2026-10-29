/** Scheduled fictional market simulation. */
import { nextPrice } from "@/lib/market-sim";
import type { RarityKey } from "@/lib/rarity";
import { prisma } from "../db";
import { invalidatePriceCache } from "./cards";
import { getSettings } from "./settings";

const LAST_TICK_KEY = "market.lastTick";

export async function getLastTick() {
  const row = await prisma.systemSetting.findUnique({ where: { key: LAST_TICK_KEY } });
  return row ? new Date((row.value as { at: string }).at) : null;
}

/**
 * Moves every active card's virtual value one step along its mean-reverting
 * random walk. The step size scales with the time since the previous tick
 * (clamped between one hour and three days).
 */
export async function runMarketTick(opts: { now?: Date; dtDays?: number; float?: () => number } = {}) {
  const now = opts.now ?? new Date();
  const { market, economy } = await getSettings();
  const last = await getLastTick();
  const elapsedDays = last ? (now.getTime() - last.getTime()) / 86_400_000 : 1;
  const dtDays = opts.dtDays ?? Math.min(3, Math.max(1 / 24, elapsedDays));
  const float = opts.float ?? Math.random;

  const cards = await prisma.card.findMany({
    where: { isActive: true },
    select: { id: true, rarity: true, baseValue: true, currentValue: true },
  });
  const updates = cards.map((c) => {
    const next = nextPrice({ current: c.currentValue, base: c.baseValue, rarity: c.rarity as RarityKey }, market, float, dtDays);
    return { id: c.id, before: c.currentValue, ...next };
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.cardPriceHistory.createMany({
        data: updates.map((u) => ({ cardId: u.id, price: u.price, volume: u.volume, recordedAt: now })),
      });
      for (const u of updates) {
        if (u.price !== u.before) await tx.card.update({ where: { id: u.id }, data: { currentValue: u.price } });
      }
      // Keep demo collectors' listings inside the price band as values move, so stale
      // seeded listings can't be bought and instantly resold to the platform at a profit.
      const minFactor = economy.instantSellBps / 10_000;
      await tx.$executeRaw`
        UPDATE "MarketplaceListing" l
        SET "price" = GREATEST(2, CEIL(c."currentValue" * ${minFactor}::float8 * 1.15))::int, "updatedAt" = NOW()
        FROM "Card" c, "User" u
        WHERE l."cardId" = c."id" AND l."sellerId" = u."id" AND u."isBot" = true AND l."status" = 'ACTIVE'
          AND l."price" < CEIL(c."currentValue" * ${minFactor}::float8)`;
      await tx.systemSetting.upsert({
        where: { key: LAST_TICK_KEY },
        create: { key: LAST_TICK_KEY, value: { at: now.toISOString() } },
        update: { value: { at: now.toISOString() } },
      });
    },
    { timeout: 60_000 },
  );
  invalidatePriceCache();

  const changed = updates.filter((u) => u.price !== u.before);
  const movers = [...updates]
    .map((u) => ({ id: u.id, change: (u.price - u.before) / u.before }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5);
  return { at: now.toISOString(), dtDays, cards: updates.length, changed: changed.length, movers };
}
