/**
 * Seed configuration for packs, mystery boxes, collectibles, daily rewards,
 * missions and achievements. Everything here is editable later from /admin.
 */
import type { CardSeed } from "./catalog";

type RarityKey = CardSeed["rarity"];

/** Odds expressed as percentages for readability; converted to ppm by the seed. */
export type OddsPercent = Partial<Record<RarityKey, number>>;

export interface PackSeed {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  cardsPerPack: number;
  theme: string;
  featured: boolean;
  odds: OddsPercent;
  /** Which catalog cards are eligible, per rarity tier. */
  pool: (card: CardSeed) => boolean;
}

/**
 * Within a rarity tier, pricier cards get proportionally lower weight so that a
 * pack's grails stay grails. Weights are shown publicly as exact percentages.
 */
export function poolWeight(value: number) {
  return Math.max(1, Math.round(1_000_000 / Math.pow(value, 0.85)));
}

const isVintageBase = (c: CardSeed) => ["base1", "base2", "base3"].includes(c.set);
const notGraded = (c: CardSeed) => c.grade === null;
const FIRE = (c: CardSeed) => c.energyType === "fire";
const EEVEE_FAMILY = new Set(["Eevee", "Vaporeon", "Jolteon", "Flareon", "Espeon", "Umbreon", "Leafeon", "Glaceon", "Sylveon"]);

export const PACKS: PackSeed[] = [
  {
    slug: "starter",
    name: "Starter Pack",
    tagline: "Your first rip",
    description: "Classic commons and uncommons from the original era, with a shot at vintage holos and a few modern hits.",
    price: 100,
    cardsPerPack: 4,
    theme: "starter",
    featured: false,
    odds: { COMMON: 70, UNCOMMON: 22.3, RARE: 6, ULTRA_RARE: 1.43, SECRET_RARE: 0.24, CHASE: 0.03 },
    pool: (c) => {
      if (!notGraded(c)) return false;
      if (c.rarity === "COMMON" || c.rarity === "UNCOMMON") return isVintageBase(c);
      if (c.rarity === "RARE") return isVintageBase(c) || c.variant === "Double Rare";
      if (c.rarity === "ULTRA_RARE") return c.value <= 500;
      if (c.rarity === "SECRET_RARE") return c.value <= 2200;
      if (c.rarity === "CHASE") return c.value <= 9500;
      return false;
    },
  },
  {
    slug: "trainer",
    name: "Trainer Pack",
    tagline: "Mixed rarity, real hits",
    description: "A balanced mix of every rarity: vintage holos, modern illustration rares and alternate-art chase cards.",
    price: 500,
    cardsPerPack: 5,
    theme: "trainer",
    featured: true,
    odds: { COMMON: 55, UNCOMMON: 25, RARE: 12, ULTRA_RARE: 6, SECRET_RARE: 1.8, CHASE: 0.2 },
    pool: (c) => {
      if (!notGraded(c)) return false;
      if (c.rarity === "COMMON" || c.rarity === "UNCOMMON") return isVintageBase(c);
      if (c.rarity === "RARE") return true;
      if (c.rarity === "ULTRA_RARE") return true;
      if (c.rarity === "SECRET_RARE") return c.value <= 3000;
      if (c.rarity === "CHASE") return c.value <= 11000;
      return false;
    },
  },
  {
    slug: "eeveelution",
    name: "Eeveelution Pack",
    tagline: "Nine evolutions, one pack",
    description: "A themed pack built around Eevee and its evolutions — from Jungle holos to Moonbreon.",
    price: 600,
    cardsPerPack: 3,
    theme: "eevee",
    featured: false,
    odds: { COMMON: 66, RARE: 24.4, ULTRA_RARE: 8, SECRET_RARE: 1.4, CHASE: 0.2 },
    pool: (c) => notGraded(c) && c.pokemon !== null && EEVEE_FAMILY.has(c.pokemon) && c.rarity !== "UNCOMMON",
  },
  {
    slug: "ultra",
    name: "Ultra Pack",
    tagline: "No commons. Ever.",
    description: "Every slot is uncommon or better, with boosted odds on holos, alternate arts and modern chase cards.",
    price: 1500,
    cardsPerPack: 5,
    theme: "ultra",
    featured: false,
    odds: { UNCOMMON: 46, RARE: 35, ULTRA_RARE: 14.6, SECRET_RARE: 3.7, CHASE: 0.7 },
    pool: (c) => {
      if (!notGraded(c)) return false;
      if (c.rarity === "COMMON") return false;
      if (c.rarity === "UNCOMMON") return isVintageBase(c) && c.value >= 13;
      if (c.rarity === "SECRET_RARE") return c.value <= 5000;
      if (c.rarity === "CHASE") return c.value <= 25000;
      return true;
    },
  },
  {
    slug: "inferno",
    name: "Inferno Pack",
    tagline: "All fire. All Charizard.",
    description: "Fire-type cards only, headlined by eight different chase Charizards.",
    price: 2500,
    cardsPerPack: 3,
    theme: "inferno",
    featured: false,
    odds: { COMMON: 19.9, UNCOMMON: 26, RARE: 26, ULTRA_RARE: 20, SECRET_RARE: 5.5, CHASE: 2.6 },
    pool: (c) => notGraded(c) && FIRE(c) && c.value <= 50000,
  },
  {
    slug: "legendary",
    name: "Legendary Pack",
    tagline: "Premium chase cards",
    description: "Holos at minimum odds of one in three, with graded vault slabs in the chase pool.",
    price: 5000,
    cardsPerPack: 5,
    theme: "legendary",
    featured: true,
    odds: { RARE: 58, ULTRA_RARE: 31, SECRET_RARE: 9.2, CHASE: 1.8 },
    pool: (c) => {
      if (c.rarity === "COMMON" || c.rarity === "UNCOMMON") return false;
      if (c.rarity === "RARE") return c.value >= 50;
      if (c.rarity === "CHASE") return c.value <= 90000;
      return true;
    },
  },
  {
    slug: "master",
    name: "Master Pack",
    tagline: "The exclusive grail pool",
    description: "Three premium slots drawn from the exclusive pool — including 1st Edition slabs and the Pikachu Illustrator.",
    price: 10000,
    cardsPerPack: 3,
    theme: "master",
    featured: true,
    odds: { ULTRA_RARE: 64, SECRET_RARE: 30, CHASE: 6 },
    pool: (c) => {
      if (c.rarity === "ULTRA_RARE") return c.value >= 500;
      return c.rarity === "SECRET_RARE" || c.rarity === "CHASE";
    },
  },
];

export interface CollectibleSeed {
  slug: string;
  name: string;
  description: string;
  rarity: RarityKey;
  icon: string;
  value: number;
  maxSupply: number | null;
}

export const COLLECTIBLES: CollectibleSeed[] = [
  { slug: "holo-booster-pin", name: "Holo Booster Pin", description: "A shimmering enamel pin commemorating your first holo.", rarity: "UNCOMMON", icon: "pin", value: 150, maxSupply: null },
  { slug: "golden-ball-trophy", name: "Golden Capture Trophy", description: "A gilded capture-ball trophy. Limited to 1,000 serials.", rarity: "RARE", icon: "trophy", value: 900, maxSupply: 1000 },
  { slug: "starlight-medal", name: "Starlight Medal", description: "Awarded to collectors who chase the stars. 2,500 serials.", rarity: "ULTRA_RARE", icon: "medal", value: 1500, maxSupply: 2500 },
  { slug: "prismatic-badge", name: "Prismatic Badge", description: "A rainbow-foil badge with only 500 serials ever minted.", rarity: "SECRET_RARE", icon: "badge", value: 5000, maxSupply: 500 },
  { slug: "vault-founder-crown", name: "Vault Founder Crown", description: "The rarest RipVault collectible. Only 100 will ever exist.", rarity: "CHASE", icon: "crown", value: 30000, maxSupply: 100 },
];

export type BoxRewardSeed =
  | { type: "COINS"; label: string; percent: number; coins: number }
  | { type: "CARD"; label: string; percent: number; card: string }
  | { type: "CARD_BUNDLE"; label: string; percent: number; cards: string[] }
  | { type: "PACK_VOUCHER"; label: string; percent: number; pack: string }
  | { type: "COLLECTIBLE"; label: string; percent: number; collectible: string; fallbackCoins: number };

export interface BoxSeed {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  theme: string;
  featured: boolean;
  rewards: BoxRewardSeed[];
}

export const MYSTERY_BOXES: BoxSeed[] = [
  {
    slug: "coin-cache",
    name: "Coin Cache",
    tagline: "Pure Rip Coin rewards",
    description: "A quick-fire box of Rip Coins with a small chance at a free pack or a 10,000 RC jackpot.",
    price: 250,
    theme: "cyan",
    featured: false,
    rewards: [
      { type: "COINS", label: "50 RC", percent: 44, coins: 50 },
      { type: "COINS", label: "120 RC", percent: 28, coins: 120 },
      { type: "COINS", label: "250 RC", percent: 15, coins: 250 },
      { type: "COINS", label: "500 RC", percent: 8.5, coins: 500 },
      { type: "PACK_VOUCHER", label: "Free Trainer Pack", percent: 1.5, pack: "trainer" },
      { type: "COINS", label: "1,500 RC", percent: 2.5, coins: 1500 },
      { type: "COINS", label: "10,000 RC Jackpot", percent: 0.5, coins: 10000 },
    ],
  },
  {
    slug: "collectors-crate",
    name: "Collector's Crate",
    tagline: "Bundles, packs & trophies",
    description: "Themed card bundles, free packs, and a chance at a limited-edition Golden Capture Trophy.",
    price: 1000,
    theme: "purple",
    featured: true,
    rewards: [
      { type: "CARD_BUNDLE", label: "Kanto Starter Trio", percent: 15.6, cards: ["base1-44", "base1-46", "base1-63"] },
      { type: "CARD_BUNDLE", label: "Jungle Eeveelution Set", percent: 20, cards: ["base2-51", "base2-19", "base2-20", "base2-28"] },
      { type: "PACK_VOUCHER", label: "Free Trainer Pack", percent: 25, pack: "trainer" },
      { type: "COINS", label: "1,000 RC", percent: 16, coins: 1000 },
      { type: "CARD", label: "Base Set Blastoise (Holo)", percent: 10, card: "base1-2" },
      { type: "COLLECTIBLE", label: "Golden Capture Trophy (limited)", percent: 6.4, collectible: "golden-ball-trophy", fallbackCoins: 900 },
      { type: "PACK_VOUCHER", label: "Free Ultra Pack", percent: 6, pack: "ultra" },
      { type: "CARD", label: "Umbreon VMAX Alternate Art", percent: 1, card: "swsh7-215" },
    ],
  },
  {
    slug: "vintage-vault",
    name: "Vintage Vault",
    tagline: "WOTC-era holos",
    description: "Original-era holos and themed bundles, with a gold-star chase at the bottom of the vault.",
    price: 3000,
    theme: "gold",
    featured: false,
    rewards: [
      { type: "CARD_BUNDLE", label: "Fossil Legendary Birds", percent: 25.6, cards: ["base3-2", "base3-12", "base3-15"] },
      { type: "CARD", label: "Base Set Venusaur (Holo)", percent: 20, card: "base1-15" },
      { type: "CARD", label: "Base Set Blastoise (Holo)", percent: 18, card: "base1-2" },
      { type: "CARD", label: "Dark Charizard (Holo)", percent: 14, card: "base5-4" },
      { type: "CARD", label: "Base Set Charizard (Holo)", percent: 10, card: "base1-4" },
      { type: "COLLECTIBLE", label: "Starlight Medal (limited)", percent: 7, collectible: "starlight-medal", fallbackCoins: 1500 },
      { type: "CARD", label: "Neo Genesis Lugia (Holo)", percent: 4, card: "neo1-9" },
      { type: "CARD", label: "Charizard ★ (Gold Star)", percent: 1.4, card: "ex15-100" },
    ],
  },
  {
    slug: "grail-box",
    name: "Grail Box",
    tagline: "Slabs, stars & crowns",
    description: "The premium box: graded vault slabs, Legendary Pack vouchers and the 100-serial Vault Founder Crown.",
    price: 7500,
    theme: "rose",
    featured: true,
    rewards: [
      { type: "COINS", label: "2,000 RC", percent: 46.5, coins: 2000 },
      { type: "PACK_VOUCHER", label: "Free Legendary Pack", percent: 30, pack: "legendary" },
      { type: "COLLECTIBLE", label: "Prismatic Badge (limited)", percent: 12.48, collectible: "prismatic-badge", fallbackCoins: 5000 },
      { type: "CARD", label: "Umbreon ex SIR", percent: 6, card: "sv85-161" },
      { type: "CARD", label: "Umbreon VMAX Alt Art · PSA 10", percent: 3, card: "vault-18-umbreon-vmax" },
      { type: "COLLECTIBLE", label: "Vault Founder Crown (limited)", percent: 1.2, collectible: "vault-founder-crown", fallbackCoins: 30000 },
      { type: "CARD", label: "Shining Charizard · PSA 10", percent: 0.8, card: "vault-17-shining-charizard" },
      { type: "CARD", label: "Charizard 1st Edition · PSA 10", percent: 0.02, card: "vault-01-charizard" },
    ],
  },
];

export const DAILY_REWARDS = [
  { day: 1, coins: 100, xp: 20, label: "100 RC" },
  { day: 2, coins: 150, xp: 25, label: "150 RC" },
  { day: 3, coins: 200, xp: 30, label: "200 RC" },
  { day: 4, coins: 250, xp: 35, label: "250 RC" },
  { day: 5, coins: 300, xp: 40, label: "300 RC" },
  { day: 6, coins: 500, xp: 50, label: "500 RC" },
  { day: 7, coins: 0, xp: 100, label: "Free Trainer Pack", pack: "trainer" },
];

export const MISSIONS = [
  { key: "daily-open-3", title: "Rip three packs", description: "Open 3 packs of any type today.", type: "OPEN_PACKS", period: "DAILY", target: 3, rewardCoins: 300, rewardXp: 50 },
  { key: "daily-unique-5", title: "Fresh pulls", description: "Add 5 cards you didn't already own to your collection today.", type: "COLLECT_UNIQUE", period: "DAILY", target: 5, rewardCoins: 250, rewardXp: 50 },
  { key: "daily-sell-dupe", title: "Trim the binder", description: "Sell a duplicate card back to the vault.", type: "SELL_DUPLICATE", period: "DAILY", target: 1, rewardCoins: 100, rewardXp: 25 },
  { key: "daily-earn-1000", title: "Coin collector", description: "Earn 1,000 RC from sales, rewards or mystery boxes today.", type: "EARN_COINS", period: "DAILY", target: 1000, rewardCoins: 200, rewardXp: 40 },
  { key: "daily-mystery", title: "Curiosity", description: "Open a mystery box today.", type: "OPEN_MYSTERY_BOX", period: "DAILY", target: 1, rewardCoins: 150, rewardXp: 30 },
  { key: "weekly-open-25", title: "Rip marathon", description: "Open 25 packs this week.", type: "OPEN_PACKS", period: "WEEKLY", target: 25, rewardCoins: 2000, rewardXp: 300 },
  { key: "weekly-unique-25", title: "Binder builder", description: "Add 25 new cards to your collection this week.", type: "COLLECT_UNIQUE", period: "WEEKLY", target: 25, rewardCoins: 1500, rewardXp: 250 },
  { key: "weekly-list-3", title: "Open for business", description: "List 3 cards on the marketplace this week.", type: "LIST_ON_MARKETPLACE", period: "WEEKLY", target: 3, rewardCoins: 500, rewardXp: 100 },
  { key: "once-complete-set", title: "Set complete", description: "Own every card of any set in the catalog.", type: "COMPLETE_SET", period: "ONCE", target: 1, rewardCoins: 5000, rewardXp: 500 },
] as const;

export const ACHIEVEMENTS = [
  { key: "first-rip", name: "First Rip", description: "Open your first pack.", icon: "PackageOpen", tier: "BRONZE", metric: "PACKS_OPENED", threshold: 1, rewardCoins: 250, rewardXp: 50 },
  { key: "pack-rat", name: "Pack Rat", description: "Open 50 packs.", icon: "Package", tier: "SILVER", metric: "PACKS_OPENED", threshold: 50, rewardCoins: 1500, rewardXp: 200 },
  { key: "rip-master", name: "Rip Master", description: "Open 250 packs.", icon: "Flame", tier: "GOLD", metric: "PACKS_OPENED", threshold: 250, rewardCoins: 5000, rewardXp: 600 },
  { key: "legend-ripper", name: "Legendary Ripper", description: "Open 1,000 packs.", icon: "Crown", tier: "PLATINUM", metric: "PACKS_OPENED", threshold: 1000, rewardCoins: 20000, rewardXp: 2000 },
  { key: "collector-25", name: "Budding Collector", description: "Own 25 unique cards.", icon: "Layers", tier: "BRONZE", metric: "UNIQUE_CARDS", threshold: 25, rewardCoins: 500, rewardXp: 100 },
  { key: "collector-100", name: "Binder Keeper", description: "Own 100 unique cards.", icon: "BookOpen", tier: "SILVER", metric: "UNIQUE_CARDS", threshold: 100, rewardCoins: 2500, rewardXp: 300 },
  { key: "collector-200", name: "Archivist", description: "Own 200 unique cards.", icon: "Library", tier: "GOLD", metric: "UNIQUE_CARDS", threshold: 200, rewardCoins: 7500, rewardXp: 800 },
  { key: "collector-300", name: "Living Dex", description: "Own 300 unique cards.", icon: "Gem", tier: "PLATINUM", metric: "UNIQUE_CARDS", threshold: 300, rewardCoins: 25000, rewardXp: 2500 },
  { key: "hoarder-500", name: "Hoarder", description: "Own 500 cards in total.", icon: "Boxes", tier: "SILVER", metric: "TOTAL_CARDS", threshold: 500, rewardCoins: 1000, rewardXp: 150 },
  { key: "value-50k", name: "Rising Portfolio", description: "Reach a collection value of 50,000 RC.", icon: "TrendingUp", tier: "SILVER", metric: "COLLECTION_VALUE", threshold: 50000, rewardCoins: 1000, rewardXp: 200 },
  { key: "value-250k", name: "Vault Elite", description: "Reach a collection value of 250,000 RC.", icon: "Landmark", tier: "GOLD", metric: "COLLECTION_VALUE", threshold: 250000, rewardCoins: 5000, rewardXp: 600 },
  { key: "value-1m", name: "Virtual Millionaire", description: "Reach a collection value of 1,000,000 RC.", icon: "Diamond", tier: "PLATINUM", metric: "COLLECTION_VALUE", threshold: 1000000, rewardCoins: 15000, rewardXp: 1500 },
  { key: "set-1", name: "Completionist", description: "Complete your first set.", icon: "BadgeCheck", tier: "GOLD", metric: "SETS_COMPLETED", threshold: 1, rewardCoins: 3000, rewardXp: 500 },
  { key: "set-5", name: "Master Completionist", description: "Complete 5 sets.", icon: "Award", tier: "PLATINUM", metric: "SETS_COMPLETED", threshold: 5, rewardCoins: 10000, rewardXp: 1500 },
  { key: "chase-hunter", name: "Chase Hunter", description: "Pull a chase card.", icon: "Star", tier: "GOLD", metric: "CHASE_PULLS", threshold: 1, rewardCoins: 2500, rewardXp: 400 },
  { key: "secret-keeper", name: "Secret Keeper", description: "Pull 5 secret rares.", icon: "Sparkles", tier: "SILVER", metric: "SECRET_PULLS", threshold: 5, rewardCoins: 1500, rewardXp: 250 },
  { key: "big-hit", name: "Big Hit", description: "Pull a single card worth 10,000 RC or more.", icon: "Zap", tier: "GOLD", metric: "BIGGEST_PULL", threshold: 10000, rewardCoins: 2000, rewardXp: 300 },
  { key: "first-sale", name: "Open for Trade", description: "Sell a card on the marketplace.", icon: "Store", tier: "BRONZE", metric: "MARKET_SALES", threshold: 1, rewardCoins: 250, rewardXp: 50 },
  { key: "merchant", name: "Merchant", description: "Complete 25 marketplace sales.", icon: "Handshake", tier: "GOLD", metric: "MARKET_SALES", threshold: 25, rewardCoins: 3000, rewardXp: 500 },
  { key: "level-10", name: "Seasoned", description: "Reach level 10.", icon: "ChevronsUp", tier: "SILVER", metric: "LEVEL", threshold: 10, rewardCoins: 1000, rewardXp: 0 },
  { key: "level-25", name: "Veteran", description: "Reach level 25.", icon: "Medal", tier: "GOLD", metric: "LEVEL", threshold: 25, rewardCoins: 5000, rewardXp: 0 },
  { key: "streak-7", name: "Weekly Regular", description: "Claim daily rewards 7 days in a row.", icon: "CalendarCheck", tier: "SILVER", metric: "LOGIN_STREAK", threshold: 7, rewardCoins: 1000, rewardXp: 150 },
  { key: "streak-30", name: "Devoted", description: "Claim daily rewards 30 days in a row.", icon: "CalendarHeart", tier: "GOLD", metric: "LOGIN_STREAK", threshold: 30, rewardCoins: 5000, rewardXp: 600 },
] as const;
