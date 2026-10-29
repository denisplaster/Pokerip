import { describe, expect, it } from "vitest";
import { buildCatalog } from "../../prisma/data/catalog";
import { MYSTERY_BOXES, PACKS, poolWeight } from "../../prisma/data/game";
import { DEFAULT_MARKET } from "@/lib/constants";
import { formatPpm, formatProbability, formatRC } from "@/lib/format";
import { generateHistory, nextPrice } from "@/lib/market-sim";
import { buildPackSnapshot, expectedPackValue, validatePackSnapshot } from "@/lib/probability";
import { RARITIES } from "@/lib/rarity";
import { createSeededRng } from "@/lib/rng";
import { safeRedirect } from "@/lib/safe-redirect";
import { instantSellPrice } from "@/server/services/collection";
import { isBigPull } from "@/server/services/packs";

describe("market simulation", () => {
  it("never leaves the configured floor/ceiling band", () => {
    const rng = createSeededRng("band");
    let price = 1000;
    for (let i = 0; i < 5_000; i++) {
      price = nextPrice({ current: price, base: 1000, rarity: "CHASE" }, DEFAULT_MARKET, () => rng.float(), 1).price;
      expect(price).toBeGreaterThanOrEqual(1000 * DEFAULT_MARKET.floorFactor);
      expect(price).toBeLessThanOrEqual(1000 * DEFAULT_MARKET.ceilingFactor);
    }
  });

  it("caps the change of a single tick", () => {
    const rng = createSeededRng("cap");
    for (let i = 0; i < 2_000; i++) {
      const next = nextPrice({ current: 10_000, base: 10_000, rarity: "CHASE" }, { ...DEFAULT_MARKET, volatility: { ...DEFAULT_MARKET.volatility, CHASE: 0.5 } }, () => rng.float(), 1);
      expect(Math.abs(next.price - 10_000) / 10_000).toBeLessThanOrEqual(DEFAULT_MARKET.maxTickChange + 0.001);
      expect(next.volume).toBeGreaterThanOrEqual(0);
    }
  });

  it("mean-reverts towards the base value", () => {
    const rng = createSeededRng("revert");
    let price = 1900;
    for (let i = 0; i < 400; i++) price = nextPrice({ current: price, base: 1000, rarity: "COMMON" }, DEFAULT_MARKET, () => rng.float(), 1).price;
    expect(price).toBeGreaterThan(700);
    expect(price).toBeLessThan(1400);
  });

  it("generates reproducible seeded history", () => {
    const a = generateHistory("base1-4", 4800, "SECRET_RARE", DEFAULT_MARKET, 90);
    const b = generateHistory("base1-4", 4800, "SECRET_RARE", DEFAULT_MARKET, 90);
    expect(a).toEqual(b);
    expect(a).toHaveLength(91);
    expect(a[a.length - 1].daysAgo).toBe(0);
  });
});

describe("seed catalog & economy", () => {
  const catalog = buildCatalog();
  const values = new Map(catalog.map((c) => [c.slug, c.value]));

  it("has at least 300 distinct cards across every rarity", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(300);
    expect(new Set(catalog.map((c) => c.slug)).size).toBe(catalog.length);
    for (const r of RARITIES) expect(catalog.some((c) => c.rarity === r)).toBe(true);
  });

  it("includes the headline cards from the brief", () => {
    const names = catalog.map((c) => `${c.name}|${c.variant ?? ""}`);
    for (const needle of ["Charizard|Holo", "Blastoise|Holo", "Venusaur|Holo", "Pikachu Illustrator|", "Umbreon VMAX|Alternate Art", "Giratina V|Alternate Art", "Rayquaza VMAX|Alternate Art", "Lugia V|Alternate Art", "Gengar VMAX|Alternate Art"]) {
      expect(names.some((n) => n.startsWith(needle.split("|")[0]) && n.includes(needle.split("|")[1]))).toBe(true);
    }
  });

  it.each(PACKS.map((p) => [p.name, p] as const))("%s has valid odds and an RTP between 75%% and 100%%", (_name, pack) => {
    const pool = catalog.filter(pack.pool).map((c) => ({ cardId: c.slug, rarity: c.rarity, weight: poolWeight(c.value) }));
    const snap = buildPackSnapshot(pack.cardsPerPack, RARITIES.map((r) => ({ rarity: r, weightPpm: Math.round((pack.odds[r] ?? 0) * 10_000) })), pool);
    expect(validatePackSnapshot(snap)).toEqual([]);
    const rtp = expectedPackValue(snap, values) / pack.price;
    expect(rtp).toBeGreaterThan(0.75);
    expect(rtp).toBeLessThan(1);
  });

  it.each(MYSTERY_BOXES.map((b) => [b.name, b] as const))("%s rewards sum to 100%%", (_name, box) => {
    const total = box.rewards.reduce((s, r) => s + Math.round(r.percent * 10_000), 0);
    expect(total).toBe(1_000_000);
  });
});

describe("economy helpers", () => {
  it("pays instant sales at the configured rate, at least 1 RC", () => {
    expect(instantSellPrice(1000, 7000)).toBe(700);
    expect(instantSellPrice(3, 7000)).toBe(2);
    expect(instantSellPrice(1, 100)).toBe(1);
  });

  it("classifies big pulls for the activity feed", () => {
    expect(isBigPull("CHASE", 100, "ULTRA_RARE", 2500)).toBe(true);
    expect(isBigPull("ULTRA_RARE", 3000, "ULTRA_RARE", 2500)).toBe(true);
    expect(isBigPull("ULTRA_RARE", 300, "ULTRA_RARE", 2500)).toBe(false);
    expect(isBigPull("RARE", 50_000, "ULTRA_RARE", 2500)).toBe(false);
  });

  it("formats coins and odds", () => {
    expect(formatRC(12500)).toBe("12,500 RC");
    expect(formatRC(250, { sign: true })).toBe("+250 RC");
    expect(formatPpm(2_000)).toBe("0.200%");
    expect(formatProbability(0.55)).toBe("55.0%");
    expect(formatProbability(0.0000123)).toBe("0.0012%");
  });

  it("only allows same-site redirects", () => {
    expect(safeRedirect("/packs")).toBe("/packs");
    expect(safeRedirect("//evil.com")).toBe("/");
    expect(safeRedirect("https://evil.com")).toBe("/");
    expect(safeRedirect("/\\evil.com")).toBe("/");
    expect(safeRedirect(undefined, "/x")).toBe("/x");
  });
});
