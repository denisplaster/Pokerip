import type { RarityKey } from "./rarity";

export const APP_NAME = "RipVault";
export const CURRENCY_NAME = "Rip Coins";
export const CURRENCY_SHORT = "RC";

/** Every new account starts with this many Rip Coins. */
export const SIGNUP_BONUS = 10_000;

export const PACK_OPEN_QUANTITIES = [1, 5, 10] as const;
export const MAX_SELL_BATCH = 200;
export const MAX_ACTIVE_LISTINGS = 50;
export const LISTING_MIN_PRICE = 1;
export const LISTING_MAX_PRICE = 50_000_000;

export const FICTIONAL_DISCLAIMER =
  "Rip Coins and all card values are fictional. They cannot be bought, withdrawn or exchanged for anything of real-world value.";

export interface EconomySettings {
  /** Share of a card's virtual value paid by the instant-sell feature, in basis points. */
  instantSellBps: number;
  /** Fee kept by the platform on marketplace sales, in basis points. */
  marketplaceFeeBps: number;
  levelUpBaseReward: number;
  levelUpPerLevel: number;
}

export interface MarketSettings {
  /** Daily volatility (standard deviation of log returns) per rarity. */
  volatility: Record<RarityKey, number>;
  /** Fraction of the gap to the base value closed per day. */
  meanReversion: number;
  /** Hard cap on the absolute change of a single tick. */
  maxTickChange: number;
  /** Values are clamped to [base × floorFactor, base × ceilingFactor]. */
  floorFactor: number;
  ceilingFactor: number;
}

export interface ActivitySettings {
  bigPullMinRarity: RarityKey;
  bigPullMinValue: number;
}

export const DEFAULT_ECONOMY: EconomySettings = {
  instantSellBps: 7000,
  marketplaceFeeBps: 500,
  levelUpBaseReward: 100,
  levelUpPerLevel: 50,
};

export const DEFAULT_MARKET: MarketSettings = {
  volatility: {
    COMMON: 0.02,
    UNCOMMON: 0.025,
    RARE: 0.035,
    ULTRA_RARE: 0.04,
    SECRET_RARE: 0.045,
    CHASE: 0.05,
  },
  meanReversion: 0.06,
  maxTickChange: 0.15,
  floorFactor: 0.5,
  ceilingFactor: 2,
};

export const DEFAULT_ACTIVITY: ActivitySettings = {
  bigPullMinRarity: "ULTRA_RARE",
  bigPullMinValue: 2_500,
};

export const AVATARS = [
  { key: "pikachu", label: "Spark", from: "#facc15", to: "#f97316" },
  { key: "charizard", label: "Blaze", from: "#f97316", to: "#dc2626" },
  { key: "blastoise", label: "Tide", from: "#38bdf8", to: "#2563eb" },
  { key: "venusaur", label: "Bloom", from: "#4ade80", to: "#15803d" },
  { key: "gengar", label: "Shade", from: "#a78bfa", to: "#6d28d9" },
  { key: "umbreon", label: "Moon", from: "#334155", to: "#facc15" },
  { key: "mewtwo", label: "Psy", from: "#e879f9", to: "#7c3aed" },
  { key: "rayquaza", label: "Sky", from: "#34d399", to: "#0f766e" },
  { key: "lugia", label: "Silver", from: "#e2e8f0", to: "#64748b" },
  { key: "gyarados", label: "Surge", from: "#22d3ee", to: "#7c3aed" },
] as const;

export type AvatarKey = (typeof AVATARS)[number]["key"];
