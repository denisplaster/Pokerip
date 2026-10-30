/**
 * Prints expected value / return-to-player for every seeded pack and mystery box,
 * using seed values. Useful when tuning odds: `npx tsx scripts/economy-report.ts`.
 */
import { buildCatalog } from "../prisma/data/catalog";
import { COLLECTIBLES, MYSTERY_BOXES, PACKS, poolWeight } from "../prisma/data/game";
import { RARITIES } from "../src/lib/rarity";
import { buildPackSnapshot, cardSlotProbabilities, expectedPackValue, packValueRange, PPM, validatePackSnapshot } from "../src/lib/probability";

const cards = buildCatalog();
const bySlug = new Map(cards.map((c) => [c.slug, c]));
const values = new Map(cards.map((c) => [c.slug, c.value]));
console.log(`Catalog: ${cards.length} cards`);
for (const r of RARITIES) console.log(`  ${r.padEnd(12)} ${cards.filter((c) => c.rarity === r).length}`);

for (const pack of PACKS) {
  const pool = cards.filter(pack.pool).map((c) => ({ cardId: c.slug, rarity: c.rarity, weight: poolWeight(c.value) }));
  const odds = RARITIES.map((r) => ({ rarity: r, weightPpm: Math.round((pack.odds[r] ?? 0) * 10_000) }));
  const snap = buildPackSnapshot(pack.cardsPerPack, odds, pool);
  const problems = validatePackSnapshot(snap);
  const ev = expectedPackValue(snap, values);
  const range = packValueRange(snap, values);
  console.log(`\n${pack.name} — ${pack.price} RC × ${pack.cardsPerPack} cards, pool ${pool.length}`);
  if (problems.length) console.log("  PROBLEMS:", problems);
  console.log(`  EV ${ev.toFixed(0)} RC  RTP ${((ev / pack.price) * 100).toFixed(1)}%  range ${range.min}–${range.max}`);
  const probs = cardSlotProbabilities(snap);
  for (const tier of snap.tiers) {
    if (!tier.weightPpm) continue;
    const tierEv = tier.cards.reduce((s, c) => s + (probs.get(c.cardId) ?? 0) * values.get(c.cardId)!, 0) * pack.cardsPerPack;
    console.log(`   ${tier.rarity.padEnd(12)} ${(tier.weightPpm / 1e4).toFixed(2).padStart(6)}%  cards ${String(tier.cards.length).padStart(3)}  EV ${tierEv.toFixed(1)}`);
  }
}

const collectibleValue = new Map(COLLECTIBLES.map((c) => [c.slug, c.value]));
for (const box of MYSTERY_BOXES) {
  let ev = 0;
  let sum = 0;
  for (const r of box.rewards) {
    sum += r.percent;
    let v = 0;
    if (r.type === "COINS") v = r.coins;
    if (r.type === "CARD") v = bySlug.get(r.card)!.value;
    if (r.type === "CARD_BUNDLE") v = r.cards.reduce((s, c) => s + bySlug.get(c)!.value, 0);
    if (r.type === "PACK_VOUCHER") v = PACKS.find((p) => p.slug === r.pack)!.price;
    if (r.type === "COLLECTIBLE") v = collectibleValue.get(r.collectible)!;
    ev += (r.percent / 100) * v;
  }
  console.log(`\nBox ${box.name} ${box.price} RC: EV ${ev.toFixed(0)} RTP ${((ev / box.price) * 100).toFixed(1)}% (sum ${sum.toFixed(3)}%)`);
}
void PPM;
