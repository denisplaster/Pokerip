/**
 * Fictional market-value engine. Prices follow a mean-reverting random walk in
 * log space around each card's base value, clamped to configurable limits.
 * These values are entertainment only and do not track any real market.
 */
import type { MarketSettings } from "./constants";
import type { RarityKey } from "./rarity";
import { createSeededRng, normal } from "./rng";

export interface TickInput {
  current: number;
  base: number;
  rarity: RarityKey;
}

const BASE_VOLUME: Record<RarityKey, number> = {
  COMMON: 420,
  UNCOMMON: 240,
  RARE: 95,
  ULTRA_RARE: 32,
  SECRET_RARE: 11,
  CHASE: 3,
};

/**
 * Computes the next price after `dtDays` days have elapsed.
 * `float` must return uniform values in [0, 1).
 */
export function nextPrice(input: TickInput, settings: MarketSettings, float: () => number, dtDays = 1) {
  const { current, base, rarity } = input;
  const sigma = settings.volatility[rarity] ?? 0.03;
  const reversion = settings.meanReversion * dtDays * Math.log(base / Math.max(1, current));
  const shock = sigma * Math.sqrt(dtDays) * normal(float);
  const maxChange = Math.log(1 + settings.maxTickChange);
  const logReturn = Math.max(-maxChange, Math.min(maxChange, reversion + shock));
  const floor = Math.max(1, Math.round(base * settings.floorFactor));
  const ceiling = Math.max(floor, Math.round(base * settings.ceilingFactor));
  const price = Math.round(Math.max(floor, Math.min(ceiling, current * Math.exp(logReturn))));
  const volume = mockVolume(rarity, Math.abs(logReturn), float, dtDays);
  return { price, volume };
}

export function mockVolume(rarity: RarityKey, absReturn: number, float: () => number, dtDays = 1) {
  const base = BASE_VOLUME[rarity] * dtDays;
  return Math.max(0, Math.round(base * (0.6 + float() * 0.8) * (1 + absReturn * 8)));
}

export interface HistoryPoint {
  daysAgo: number;
  price: number;
  volume: number;
}

/**
 * Reproducible daily history for seeding: the same slug always produces the
 * same series. Starts near the base value `days` ago and walks forward.
 */
export function generateHistory(slug: string, base: number, rarity: RarityKey, settings: MarketSettings, days = 90): HistoryPoint[] {
  const rng = createSeededRng(`history:${slug}`);
  const float = () => rng.float();
  let price = Math.max(1, Math.round(base * (0.85 + float() * 0.3)));
  const points: HistoryPoint[] = [];
  for (let d = days; d >= 0; d--) {
    const next = nextPrice({ current: price, base, rarity }, settings, float, 1);
    price = next.price;
    points.push({ daysAgo: d, price, volume: next.volume });
  }
  return points;
}

export function percentChange(from: number | null | undefined, to: number) {
  if (!from || from <= 0) return null;
  return (to - from) / from;
}
