/**
 * Rarity tiers, ordered from most to least common. This order is shared by the
 * probability engine, odds tables and UI, so never reorder it.
 */
export const RARITIES = ["COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "SECRET_RARE", "CHASE"] as const;
export type RarityKey = (typeof RARITIES)[number];

export interface RarityMeta {
  key: RarityKey;
  label: string;
  short: string;
  /** Tailwind text colour class. */
  text: string;
  /** Tailwind border colour class. */
  border: string;
  /** Tailwind background class for chips. */
  chip: string;
  /** CSS colour used for glows and charts. */
  color: string;
  rank: number;
}

export const RARITY_META: Record<RarityKey, RarityMeta> = {
  COMMON: {
    key: "COMMON",
    label: "Common",
    short: "C",
    text: "text-zinc-300",
    border: "border-zinc-500/40",
    chip: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/30",
    color: "#a1a1aa",
    rank: 0,
  },
  UNCOMMON: {
    key: "UNCOMMON",
    label: "Uncommon",
    short: "U",
    text: "text-sky-300",
    border: "border-sky-400/50",
    chip: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
    color: "#38bdf8",
    rank: 1,
  },
  RARE: {
    key: "RARE",
    label: "Rare",
    short: "R",
    text: "text-violet-300",
    border: "border-violet-400/60",
    chip: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
    color: "#a78bfa",
    rank: 2,
  },
  ULTRA_RARE: {
    key: "ULTRA_RARE",
    label: "Ultra Rare",
    short: "UR",
    text: "text-amber-300",
    border: "border-amber-400/70",
    chip: "bg-amber-500/15 text-amber-300 ring-amber-400/40",
    color: "#fbbf24",
    rank: 3,
  },
  SECRET_RARE: {
    key: "SECRET_RARE",
    label: "Secret Rare",
    short: "SR",
    text: "text-fuchsia-300",
    border: "border-fuchsia-400/70",
    chip: "bg-gradient-to-r from-fuchsia-500/20 via-cyan-400/20 to-amber-300/20 text-fuchsia-200 ring-fuchsia-300/40",
    color: "#e879f9",
    rank: 4,
  },
  CHASE: {
    key: "CHASE",
    label: "Chase",
    short: "★",
    text: "text-rose-300",
    border: "border-rose-400/80",
    chip: "bg-gradient-to-r from-rose-500/25 via-amber-400/25 to-violet-500/25 text-rose-100 ring-rose-300/50",
    color: "#fb7185",
    rank: 5,
  },
};

export function rarityRank(rarity: RarityKey) {
  return RARITY_META[rarity].rank;
}

export function isRarityAtLeast(rarity: RarityKey, min: RarityKey) {
  return rarityRank(rarity) >= rarityRank(min);
}

export function compareRarity(a: RarityKey, b: RarityKey) {
  return rarityRank(a) - rarityRank(b);
}
