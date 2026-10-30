/**
 * Optional: enrich the catalog with artwork URLs and metadata from TCGdex
 * (https://tcgdex.dev), an open community API. Only run this if the API's terms
 * suit your deployment — card images are © The Pokémon Company and remain
 * subject to their rights. Without it, RipVault renders its own placeholder art.
 *
 *   npm run cards:import            # dry run: shows what would change
 *   npm run cards:import -- --apply # write imageUrl / externalId to the database
 */
import "dotenv/config";
import { prisma } from "../src/server/db";

// RipVault set code → TCGdex set id.
const SET_MAP: Record<string, string> = {
  base1: "base1",
  base2: "base2",
  base3: "base3",
  base5: "base5",
  neo1: "neo1",
  neo4: "neo4",
  ecard3: "ecard3",
  ex8: "ex8",
  ex15: "ex15",
  pop5: "pop5",
  sm115: "sm115",
  swsh35: "swsh3.5",
  swsh4: "swsh4",
  swsh45: "swsh4.5",
  swsh7: "swsh7",
  swsh8: "swsh8",
  swsh9: "swsh9",
  swsh11: "swsh11",
  swsh12: "swsh12",
  swsh125: "swsh12.5",
  sv3: "sv03",
  sv35: "sv03.5",
  sv45: "sv04.5",
  sv85: "sv08.5",
};

const apply = process.argv.includes("--apply");
const BASE = process.env.TCGDEX_BASE_URL ?? "https://api.tcgdex.net/v2/en";

function localId(number: string) {
  const raw = number.split("/")[0];
  return /^\d+$/.test(raw) ? String(Number(raw)) : raw;
}

async function fetchCard(setId: string, id: string) {
  const res = await fetch(`${BASE}/sets/${encodeURIComponent(setId)}/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; name: string; image?: string; rarity?: string };
}

async function main() {
  const cards = await prisma.card.findMany({ where: { grade: null }, include: { set: true } });
  let matched = 0;
  let updated = 0;
  for (const card of cards) {
    const setId = SET_MAP[card.set.code];
    if (!setId) continue;
    let remote;
    try {
      remote = await fetchCard(setId, localId(card.number));
    } catch (error) {
      console.error(`Network error for ${card.slug}: ${(error as Error).message}`);
      console.error("TCGdex is unreachable from this environment — aborting without changes.");
      process.exitCode = 1;
      return;
    }
    if (!remote) {
      console.warn(`  no match: ${card.slug} (${card.name} ${card.number})`);
      continue;
    }
    matched++;
    const imageUrl = remote.image ? `${remote.image}/high.webp` : null;
    if (remote.name.toLowerCase().replace(/[^a-z]/g, "") !== card.name.toLowerCase().replace(/[^a-z]/g, "")) {
      console.warn(`  name differs: ${card.slug} local "${card.name}" vs TCGdex "${remote.name}" — skipped`);
      continue;
    }
    if (apply && imageUrl && (card.imageUrl !== imageUrl || card.externalId !== remote.id)) {
      await prisma.card.update({ where: { id: card.id }, data: { imageUrl, externalId: remote.id } });
      updated++;
    }
  }
  console.log(`${matched}/${cards.length} cards matched on TCGdex; ${apply ? `${updated} updated` : "dry run (pass --apply to write)"}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
