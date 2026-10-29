import { describe, expect, it } from "vitest";
import {
  buildPackSnapshot,
  cardSlotProbabilities,
  chiSquareSurvival,
  chiSquareTest,
  compilePackOdds,
  drawCard,
  drawWeighted,
  expectedPackValue,
  OddsConfigError,
  packValueRange,
  PPM,
  resolveDraw,
  resolveWeighted,
  simulatePacks,
  validatePackSnapshot,
  validateWeightedOutcomes,
} from "@/lib/probability";
import { RARITIES } from "@/lib/rarity";
import { createSeededRng } from "@/lib/rng";
import { cryptoRng } from "@/server/crypto-rng";

/** The example distribution from the product brief. */
const EXAMPLE_ODDS = [
  { rarity: "COMMON", weightPpm: 550_000 },
  { rarity: "UNCOMMON", weightPpm: 250_000 },
  { rarity: "RARE", weightPpm: 120_000 },
  { rarity: "ULTRA_RARE", weightPpm: 60_000 },
  { rarity: "SECRET_RARE", weightPpm: 18_000 },
  { rarity: "CHASE", weightPpm: 2_000 },
] as const;

function makePool() {
  const pool = [];
  for (const r of RARITIES) {
    const n = r === "CHASE" ? 3 : r === "SECRET_RARE" ? 5 : 12;
    for (let i = 0; i < n; i++) pool.push({ cardId: `${r}-${i}`, rarity: r, weight: 10 + i * 7 });
  }
  return pool;
}

const snapshot = buildPackSnapshot(5, [...EXAMPLE_ODDS], makePool());
const compiled = compilePackOdds(snapshot);

describe("odds validation", () => {
  it("accepts a normalised configuration", () => {
    expect(validatePackSnapshot(snapshot)).toEqual([]);
  });

  it("rejects odds that do not sum to exactly 100%", () => {
    const bad = buildPackSnapshot(5, [{ rarity: "COMMON", weightPpm: 999_999 }], makePool());
    expect(validatePackSnapshot(bad).join()).toMatch(/sum to 100%/);
    expect(() => compilePackOdds(bad)).toThrow(OddsConfigError);
  });

  it("rejects a tier with probability but no eligible cards", () => {
    const pool = makePool().filter((c) => c.rarity !== "CHASE");
    const bad = buildPackSnapshot(5, [...EXAMPLE_ODDS], pool);
    expect(validatePackSnapshot(bad).join()).toMatch(/CHASE: has a 2000 ppm chance but no eligible cards/);
  });

  it("rejects non-positive card weights and invalid pack sizes", () => {
    const pool = makePool();
    pool[0].weight = 0;
    expect(validatePackSnapshot(buildPackSnapshot(0, [...EXAMPLE_ODDS], pool)).length).toBeGreaterThanOrEqual(2);
  });

  it("produces canonical snapshots independent of input order", () => {
    const shuffled = [...makePool()].reverse();
    expect(buildPackSnapshot(5, [...EXAMPLE_ODDS].reverse(), shuffled)).toEqual(snapshot);
  });
});

describe("draw resolution", () => {
  it("maps roll boundaries to the correct tiers", () => {
    expect(resolveDraw(compiled, 0, 0).rarity).toBe("COMMON");
    expect(resolveDraw(compiled, 549_999, 0).rarity).toBe("COMMON");
    expect(resolveDraw(compiled, 550_000, 0).rarity).toBe("UNCOMMON");
    expect(resolveDraw(compiled, 997_999, 0).rarity).toBe("SECRET_RARE");
    expect(resolveDraw(compiled, 998_000, 0).rarity).toBe("CHASE");
    expect(resolveDraw(compiled, PPM - 1, 0).rarity).toBe("CHASE");
  });

  it("maps card rolls through cumulative weights", () => {
    // CHASE cards have weights 10, 17, 24 -> cumulative 10, 27, 51.
    expect(resolveDraw(compiled, PPM - 1, 0).cardId).toBe("CHASE-0");
    expect(resolveDraw(compiled, PPM - 1, 9).cardId).toBe("CHASE-0");
    expect(resolveDraw(compiled, PPM - 1, 10).cardId).toBe("CHASE-1");
    expect(resolveDraw(compiled, PPM - 1, 26).cardId).toBe("CHASE-1");
    expect(resolveDraw(compiled, PPM - 1, 50).cardId).toBe("CHASE-2");
  });

  it("rejects out-of-range rolls", () => {
    expect(() => resolveDraw(compiled, PPM, 0)).toThrow(RangeError);
    expect(() => resolveDraw(compiled, -1, 0)).toThrow(RangeError);
    expect(() => resolveDraw(compiled, PPM - 1, 51)).toThrow(RangeError);
  });

  it("is replayable: recorded rolls always resolve to the recorded card", () => {
    const rng = createSeededRng("replay");
    for (let i = 0; i < 5_000; i++) {
      const draw = drawCard(compiled, rng);
      expect(resolveDraw(compiled, draw.rarityRoll, draw.cardRoll)).toEqual(draw);
    }
  });

  it("never draws cards outside the pool or from zero-probability tiers", () => {
    const pool = makePool();
    const noChase = buildPackSnapshot(5, [{ rarity: "COMMON", weightPpm: 900_000 }, { rarity: "RARE", weightPpm: 100_000 }], pool);
    const c = compilePackOdds(noChase);
    const sim = simulatePacks(c, 20_000, createSeededRng("no-chase"));
    expect(sim.rarityCounts.CHASE).toBe(0);
    expect(sim.rarityCounts.UNCOMMON).toBe(0);
    for (const id of sim.cardCounts.keys()) expect(pool.some((p) => p.cardId === id)).toBe(true);
  });
});

describe("statistical distribution (large simulations)", () => {
  it("matches published rarity odds over 1,000,000 cards (seeded)", () => {
    const sim = simulatePacks(compiled, 200_000, createSeededRng("rarity-distribution"));
    expect(sim.cards).toBe(1_000_000);
    const observed = RARITIES.map((r) => sim.rarityCounts[r]);
    const expected = EXAMPLE_ODDS.map((o) => o.weightPpm / PPM);
    const { pValue } = chiSquareTest(observed, expected);
    expect(pValue).toBeGreaterThan(1e-4);
    // Every tier within 5 standard deviations of its expected count.
    EXAMPLE_ODDS.forEach((o, i) => {
      const p = o.weightPpm / PPM;
      const mean = sim.cards * p;
      const sd = Math.sqrt(sim.cards * p * (1 - p));
      expect(Math.abs(observed[i] - mean)).toBeLessThan(5 * sd);
    });
  });

  it("matches per-card probabilities within each tier", () => {
    const sim = simulatePacks(compiled, 200_000, createSeededRng("card-distribution"));
    const probs = cardSlotProbabilities(snapshot);
    const ids = [...probs.keys()];
    const observed = ids.map((id) => sim.cardCounts.get(id) ?? 0);
    const { pValue } = chiSquareTest(observed, ids.map((id) => probs.get(id)!));
    expect(pValue).toBeGreaterThan(1e-4);
  });

  it("matches published odds using the production CSPRNG", () => {
    const sim = simulatePacks(compiled, 40_000, cryptoRng);
    const observed = RARITIES.map((r) => sim.rarityCounts[r]);
    const { pValue } = chiSquareTest(observed, EXAMPLE_ODDS.map((o) => o.weightPpm / PPM));
    // Extremely unlikely to fail by chance (1 in a million).
    expect(pValue).toBeGreaterThan(1e-6);
  });

  it("has a simulated mean pack value that matches the analytic expected value", () => {
    const values = new Map([...cardSlotProbabilities(snapshot).keys()].map((id, i) => [id, 5 + (i % 9) * 40 + (id.startsWith("CHASE") ? 20_000 : 0)]));
    const ev = expectedPackValue(snapshot, values);
    const sim = simulatePacks(compiled, 100_000, createSeededRng("ev"), values);
    const mean = sim.totalValue / sim.packs;
    expect(Math.abs(mean - ev) / ev).toBeLessThan(0.05);
    const range = packValueRange(snapshot, values);
    expect(Math.min(...sim.packValues)).toBeGreaterThanOrEqual(range.min);
    expect(Math.max(...sim.packValues)).toBeLessThanOrEqual(range.max);
  });

  it("slot probabilities sum to exactly 1", () => {
    const total = [...cardSlotProbabilities(snapshot).values()].reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 12);
  });
});

describe("weighted outcomes (mystery boxes)", () => {
  const outcomes = [
    { id: "a", weightPpm: 700_000 },
    { id: "b", weightPpm: 250_000 },
    { id: "c", weightPpm: 49_000 },
    { id: "d", weightPpm: 1_000 },
  ];

  it("validates normalisation", () => {
    expect(validateWeightedOutcomes(outcomes)).toEqual([]);
    expect(validateWeightedOutcomes([{ id: "x", weightPpm: 10 }]).length).toBe(1);
    expect(() => drawWeighted([{ id: "x", weightPpm: 10 }], cryptoRng)).toThrow(OddsConfigError);
  });

  it("resolves boundaries", () => {
    expect(resolveWeighted(outcomes, 0).id).toBe("a");
    expect(resolveWeighted(outcomes, 699_999).id).toBe("a");
    expect(resolveWeighted(outcomes, 700_000).id).toBe("b");
    expect(resolveWeighted(outcomes, PPM - 1).id).toBe("d");
  });

  it("matches published odds over 500,000 draws", () => {
    const rng = createSeededRng("boxes");
    const counts = new Map<string, number>();
    for (let i = 0; i < 500_000; i++) {
      const { outcome } = drawWeighted(outcomes, rng);
      counts.set(outcome.id, (counts.get(outcome.id) ?? 0) + 1);
    }
    const { pValue } = chiSquareTest(outcomes.map((o) => counts.get(o.id) ?? 0), outcomes.map((o) => o.weightPpm / PPM));
    expect(pValue).toBeGreaterThan(1e-4);
  });
});

describe("RNG + chi-square calibration", () => {
  it("produces uniformly distributed p-values across independent seeds", () => {
    // If the generator or the test statistic were biased, small p-values would be over-represented.
    const outcomes = [
      { id: "a", weightPpm: 700_000 },
      { id: "b", weightPpm: 250_000 },
      { id: "c", weightPpm: 49_000 },
      { id: "d", weightPpm: 1_000 },
    ];
    const pValues: number[] = [];
    for (let s = 0; s < 100; s++) {
      const rng = createSeededRng(`calibration-${s}`);
      const counts = new Map<string, number>();
      for (let i = 0; i < 40_000; i++) {
        const { outcome } = drawWeighted(outcomes, rng);
        counts.set(outcome.id, (counts.get(outcome.id) ?? 0) + 1);
      }
      pValues.push(chiSquareTest(outcomes.map((o) => counts.get(o.id) ?? 0), outcomes.map((o) => o.weightPpm / PPM)).pValue);
    }
    const deciles = new Array(10).fill(0);
    for (const p of pValues) deciles[Math.min(9, Math.floor(p * 10))]++;
    expect(chiSquareTest(deciles, new Array(10).fill(0.1)).pValue).toBeGreaterThan(1e-4);
    expect(pValues.filter((p) => p < 0.01).length).toBeLessThanOrEqual(6);
  });
});

describe("chi-square helper", () => {
  it("returns textbook critical values", () => {
    expect(chiSquareSurvival(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chiSquareSurvival(11.07, 5)).toBeCloseTo(0.05, 3);
    expect(chiSquareSurvival(20.515, 5)).toBeCloseTo(0.001, 4);
  });

  it("flags biased data", () => {
    const { pValue } = chiSquareTest([600, 400], [0.5, 0.5]);
    expect(pValue).toBeLessThan(1e-9);
  });
});

describe("seeded RNG", () => {
  it("is reproducible and roughly uniform", () => {
    const a = createSeededRng("x");
    const b = createSeededRng("x");
    const seqA = Array.from({ length: 20 }, () => a.int(1000));
    const seqB = Array.from({ length: 20 }, () => b.int(1000));
    expect(seqA).toEqual(seqB);
    const rng = createSeededRng("uniform");
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) buckets[rng.int(10)]++;
    expect(chiSquareTest(buckets, new Array(10).fill(0.1)).pValue).toBeGreaterThan(0.001);
  });

  it("validates its bounds", () => {
    expect(() => createSeededRng(1).int(0)).toThrow(RangeError);
    expect(() => createSeededRng(1).int(1.5)).toThrow(RangeError);
  });
});
