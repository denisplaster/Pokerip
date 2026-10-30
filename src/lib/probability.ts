/**
 * Configurable weighted-random probability engine shared by packs, mystery boxes,
 * the admin simulator and the statistical test-suite.
 *
 * Design rules (enforced here and by tests):
 *  - Odds are integers in parts-per-million (ppm) that must sum to exactly 1,000,000.
 *  - The engine is a pure function of (odds snapshot, RNG output). It never sees the
 *    user, their balance or their history, so outcomes cannot be tailored to a player.
 *  - Every draw records its raw rolls so it can be replayed and audited later.
 */
import { RARITIES, type RarityKey } from "./rarity";
import type { Rng } from "./rng";

export const PPM = 1_000_000;
export const MAX_CARDS_PER_PACK = 20;

export interface OddsTierInput {
  rarity: RarityKey;
  weightPpm: number;
}

export interface PoolCardInput {
  cardId: string;
  rarity: RarityKey;
  weight: number;
}

export interface SnapshotTier {
  rarity: RarityKey;
  weightPpm: number;
  cards: { cardId: string; weight: number }[];
}

/** Canonical, JSON-serialisable odds configuration stored in OddsVersion.data. */
export interface PackOddsSnapshot {
  schema: 1;
  cardsPerPack: number;
  tiers: SnapshotTier[];
}

export class OddsConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid odds configuration: ${problems.join("; ")}`);
    this.name = "OddsConfigError";
  }
}

/** Builds a canonical snapshot (stable ordering) from editable pack configuration. */
export function buildPackSnapshot(cardsPerPack: number, odds: OddsTierInput[], pool: PoolCardInput[]): PackOddsSnapshot {
  const byRarity = new Map<RarityKey, number>(odds.map((o) => [o.rarity, o.weightPpm]));
  return {
    schema: 1,
    cardsPerPack,
    tiers: RARITIES.map((rarity) => ({
      rarity,
      weightPpm: byRarity.get(rarity) ?? 0,
      cards: pool
        .filter((c) => c.rarity === rarity)
        .map((c) => ({ cardId: c.cardId, weight: c.weight }))
        .sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0)),
    })),
  };
}

export function validatePackSnapshot(snapshot: PackOddsSnapshot): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(snapshot.cardsPerPack) || snapshot.cardsPerPack < 1 || snapshot.cardsPerPack > MAX_CARDS_PER_PACK) {
    problems.push(`cardsPerPack must be between 1 and ${MAX_CARDS_PER_PACK}`);
  }
  let sum = 0;
  for (const tier of snapshot.tiers) {
    if (!Number.isInteger(tier.weightPpm) || tier.weightPpm < 0) {
      problems.push(`${tier.rarity}: probability must be a non-negative integer ppm`);
      continue;
    }
    sum += tier.weightPpm;
    if (tier.weightPpm > 0 && tier.cards.length === 0) {
      problems.push(`${tier.rarity}: has a ${tier.weightPpm} ppm chance but no eligible cards`);
    }
    for (const card of tier.cards) {
      if (!Number.isInteger(card.weight) || card.weight <= 0) {
        problems.push(`${tier.rarity}: card ${card.cardId} has invalid weight ${card.weight}`);
      }
    }
  }
  if (sum !== PPM) {
    problems.push(`rarity probabilities must sum to 100% (got ${(sum / 10_000).toFixed(4)}%)`);
  }
  return problems;
}

interface CompiledTier {
  rarity: RarityKey;
  /** Exclusive upper bound of this tier's ppm range. */
  upper: number;
  totalWeight: number;
  cards: { cardId: string; upper: number }[];
}

export interface CompiledPackOdds {
  snapshot: PackOddsSnapshot;
  tiers: CompiledTier[];
}

export function compilePackOdds(snapshot: PackOddsSnapshot): CompiledPackOdds {
  const problems = validatePackSnapshot(snapshot);
  if (problems.length) throw new OddsConfigError(problems);
  let cumulative = 0;
  const tiers: CompiledTier[] = [];
  for (const tier of snapshot.tiers) {
    if (tier.weightPpm === 0) continue;
    cumulative += tier.weightPpm;
    let w = 0;
    const cards = tier.cards.map((c) => {
      w += c.weight;
      return { cardId: c.cardId, upper: w };
    });
    tiers.push({ rarity: tier.rarity, upper: cumulative, totalWeight: w, cards });
  }
  return { snapshot, tiers };
}

export interface Draw {
  rarity: RarityKey;
  cardId: string;
  rarityRoll: number;
  cardRoll: number;
}

/**
 * Maps raw rolls to an outcome. Pure and deterministic, which is what makes
 * stored openings replayable for audits.
 */
export function resolveDraw(compiled: CompiledPackOdds, rarityRoll: number, cardRoll: number): Draw {
  if (!Number.isInteger(rarityRoll) || rarityRoll < 0 || rarityRoll >= PPM) {
    throw new RangeError(`rarityRoll out of range: ${rarityRoll}`);
  }
  const tier = compiled.tiers.find((t) => rarityRoll < t.upper);
  if (!tier) throw new Error("No tier matched roll — odds not normalised");
  if (!Number.isInteger(cardRoll) || cardRoll < 0 || cardRoll >= tier.totalWeight) {
    throw new RangeError(`cardRoll out of range: ${cardRoll}`);
  }
  // Binary search over cumulative weights.
  let lo = 0;
  let hi = tier.cards.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cardRoll < tier.cards[mid].upper) hi = mid;
    else lo = mid + 1;
  }
  return { rarity: tier.rarity, cardId: tier.cards[lo].cardId, rarityRoll, cardRoll };
}

export function drawCard(compiled: CompiledPackOdds, rng: Rng): Draw {
  const rarityRoll = rng.int(PPM);
  const tier = compiled.tiers.find((t) => rarityRoll < t.upper)!;
  const cardRoll = rng.int(tier.totalWeight);
  return resolveDraw(compiled, rarityRoll, cardRoll);
}

export function drawPack(compiled: CompiledPackOdds, rng: Rng): Draw[] {
  return Array.from({ length: compiled.snapshot.cardsPerPack }, () => drawCard(compiled, rng));
}

/** Probability that a single card slot yields each card. */
export function cardSlotProbabilities(snapshot: PackOddsSnapshot): Map<string, number> {
  const out = new Map<string, number>();
  for (const tier of snapshot.tiers) {
    if (tier.weightPpm === 0) continue;
    const total = tier.cards.reduce((s, c) => s + c.weight, 0);
    for (const card of tier.cards) {
      const p = (tier.weightPpm / PPM) * (card.weight / total);
      out.set(card.cardId, (out.get(card.cardId) ?? 0) + p);
    }
  }
  return out;
}

/** Probability of pulling a given card at least once in a whole pack. */
export function atLeastOnceInPack(slotProbability: number, cardsPerPack: number) {
  return 1 - Math.pow(1 - slotProbability, cardsPerPack);
}

export function expectedPackValue(snapshot: PackOddsSnapshot, values: Map<string, number>) {
  let perSlot = 0;
  for (const [cardId, p] of cardSlotProbabilities(snapshot)) perSlot += p * (values.get(cardId) ?? 0);
  return perSlot * snapshot.cardsPerPack;
}

export function packValueRange(snapshot: PackOddsSnapshot, values: Map<string, number>) {
  let min = Infinity;
  let max = 0;
  for (const tier of snapshot.tiers) {
    if (tier.weightPpm === 0) continue;
    for (const c of tier.cards) {
      const v = values.get(c.cardId) ?? 0;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (!Number.isFinite(min)) min = 0;
  return { min: min * snapshot.cardsPerPack, max: max * snapshot.cardsPerPack };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic single-outcome weighted draws (mystery boxes)
// ─────────────────────────────────────────────────────────────────────────────

export interface WeightedOutcome {
  id: string;
  weightPpm: number;
}

export function validateWeightedOutcomes(outcomes: WeightedOutcome[]): string[] {
  const problems: string[] = [];
  if (outcomes.length === 0) problems.push("at least one outcome is required");
  let sum = 0;
  for (const o of outcomes) {
    if (!Number.isInteger(o.weightPpm) || o.weightPpm < 0) problems.push(`${o.id}: invalid weight ${o.weightPpm}`);
    else sum += o.weightPpm;
  }
  if (sum !== PPM) problems.push(`probabilities must sum to 100% (got ${(sum / 10_000).toFixed(4)}%)`);
  return problems;
}

export function resolveWeighted<T extends WeightedOutcome>(outcomes: T[], roll: number): T {
  if (!Number.isInteger(roll) || roll < 0 || roll >= PPM) throw new RangeError(`roll out of range: ${roll}`);
  let cumulative = 0;
  for (const o of outcomes) {
    cumulative += o.weightPpm;
    if (roll < cumulative) return o;
  }
  throw new Error("Weighted outcomes are not normalised");
}

export function drawWeighted<T extends WeightedOutcome>(outcomes: T[], rng: Rng): { outcome: T; roll: number } {
  const problems = validateWeightedOutcomes(outcomes);
  if (problems.length) throw new OddsConfigError(problems);
  const roll = rng.int(PPM);
  return { outcome: resolveWeighted(outcomes, roll), roll };
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulation & statistics
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulationResult {
  packs: number;
  cards: number;
  rarityCounts: Record<RarityKey, number>;
  cardCounts: Map<string, number>;
  totalValue: number;
  /** Pack values, useful for histograms. Only collected when values were provided. */
  packValues: number[];
}

export function simulatePacks(
  compiled: CompiledPackOdds,
  packs: number,
  rng: Rng,
  values?: Map<string, number>,
): SimulationResult {
  const rarityCounts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<RarityKey, number>;
  const cardCounts = new Map<string, number>();
  const packValues: number[] = [];
  let totalValue = 0;
  for (let i = 0; i < packs; i++) {
    let packValue = 0;
    for (const draw of drawPack(compiled, rng)) {
      rarityCounts[draw.rarity]++;
      cardCounts.set(draw.cardId, (cardCounts.get(draw.cardId) ?? 0) + 1);
      if (values) packValue += values.get(draw.cardId) ?? 0;
    }
    if (values) {
      packValues.push(packValue);
      totalValue += packValue;
    }
  }
  return { packs, cards: packs * compiled.snapshot.cardsPerPack, rarityCounts, cardCounts, totalValue, packValues };
}

/**
 * Pearson chi-square goodness-of-fit test. Categories with zero expected
 * probability are ignored (they must also have zero observations).
 */
export function chiSquareTest(observed: number[], expectedProbabilities: number[]) {
  const n = observed.reduce((a, b) => a + b, 0);
  let statistic = 0;
  let categories = 0;
  for (let i = 0; i < observed.length; i++) {
    const p = expectedProbabilities[i];
    if (p <= 0) {
      if (observed[i] > 0) return { statistic: Infinity, df: Math.max(1, categories), pValue: 0 };
      continue;
    }
    const expected = n * p;
    statistic += (observed[i] - expected) ** 2 / expected;
    categories++;
  }
  const df = Math.max(1, categories - 1);
  return { statistic, df, pValue: chiSquareSurvival(statistic, df) };
}

/** P(X >= x) for a chi-square distribution with k degrees of freedom. */
export function chiSquareSurvival(x: number, k: number) {
  if (x <= 0) return 1;
  return regularizedGammaQ(k / 2, x / 2);
}

function regularizedGammaQ(a: number, x: number) {
  if (x < a + 1) return 1 - gammaSeries(a, x);
  return gammaContinuedFraction(a, x);
}

function gammaSeries(a: number, x: number) {
  let sum = 1 / a;
  let term = sum;
  for (let n = 1; n < 1000; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

function gammaContinuedFraction(a: number, x: number) {
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

function logGamma(z: number): number {
  // Lanczos approximation (g = 7, n = 9).
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) x += coef[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
