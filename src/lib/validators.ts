import { z } from "zod";
import { LISTING_MAX_PRICE, LISTING_MIN_PRICE, MAX_SELL_BATCH } from "./constants";
import { RARITIES } from "./rarity";

const id = z.string().min(1).max(64);

/** Hosts allowed for card artwork (must match next.config.ts images.remotePatterns). */
export const IMAGE_HOSTS = ["assets.tcgdex.net", "images.pokemontcg.io"];
export const idempotencyKey = z
  .string()
  .min(8)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid idempotency key");

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[A-Za-z0-9_]+$/, "Use letters, numbers and underscores only");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.email("Enter a valid email").trim().toLowerCase().max(254),
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: "Please confirm you understand Rip Coins are fictional" }),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or username").max(254),
  password: z.string().min(1, "Enter your password").max(128),
});

export const openPackSchema = z.object({
  quantity: z.union([z.literal(1), z.literal(5), z.literal(10)]),
  idempotencyKey,
  useVoucher: z.boolean().optional().default(false),
});

export const openBoxSchema = z.object({ idempotencyKey });

export const sellCardsSchema = z.object({
  userCardIds: z.array(id).min(1).max(MAX_SELL_BATCH),
});

export const sellDuplicatesSchema = z.object({
  rarities: z.array(z.enum(RARITIES)).min(1),
  keep: z.number().int().min(1).max(10).default(1),
});

export const favoriteSchema = z.object({ cardId: id, favorite: z.boolean() });

export const createListingSchema = z.object({
  userCardId: id,
  price: z.number().int().min(LISTING_MIN_PRICE).max(LISTING_MAX_PRICE),
});

export const listingsQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  rarity: z.enum(RARITIES).optional(),
  set: z.string().max(40).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "value_ratio"]).default("newest"),
  cardId: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export const profileUpdateSchema = z.object({
  username: usernameSchema.optional(),
  bio: z.string().trim().max(240).optional(),
  avatar: z.string().max(32).optional(),
  profileVisibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const leaderboardQuerySchema = z.object({
  category: z.enum(["collection_value", "biggest_pull", "cards_collected", "unique_cards", "level", "sets_completed"]),
  period: z.enum(["day", "week", "month", "all"]).default("all"),
});

// ── Admin ────────────────────────────────────────────────────────────────────

export const adminAdjustBalanceSchema = z.object({
  idempotencyKey: idempotencyKey.optional(),
  amount: z
    .number()
    .int()
    .min(-10_000_000)
    .max(10_000_000)
    .refine((v) => v !== 0, "Amount cannot be zero"),
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters").max(200),
});

export const adminUserUpdateSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  suspended: z.boolean().optional(),
});

const ppm = z.number().int().min(0).max(1_000_000);

export const adminPackSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  tagline: z.string().trim().max(80),
  description: z.string().trim().max(400),
  price: z.number().int().min(1).max(10_000_000),
  cardsPerPack: z.number().int().min(1).max(20),
  theme: z.string().max(20),
  isActive: z.boolean(),
  featured: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
});

export const adminOddsSchema = z.object({
  odds: z.array(z.object({ rarity: z.enum(RARITIES), weightPpm: ppm })).length(RARITIES.length),
  pool: z.array(z.object({ cardId: id, weight: z.number().int().min(1).max(1_000_000) })).max(1000),
});

export const adminCardSchema = z.object({
  name: z.string().trim().min(1).max(80),
  pokemon: z.string().trim().max(40).nullable(),
  setId: id,
  number: z.string().trim().min(1).max(20),
  variant: z.string().trim().max(60).nullable(),
  rarity: z.enum(RARITIES),
  energyType: z.string().max(20),
  imageUrl: z
    .url({ protocol: /^https$/ })
    .max(500)
    .refine((u) => IMAGE_HOSTS.includes(new URL(u).hostname), `Images must be hosted on ${IMAGE_HOSTS.join(" or ")}`)
    .nullable(),
  grade: z.string().trim().max(20).nullable(),
  releaseYear: z.number().int().min(1990).max(2100),
  category: z.enum(["VINTAGE", "MODERN", "ILLUSTRATION", "GRADED", "PROMO"]),
  baseValue: z.number().int().min(1).max(100_000_000),
  currentValue: z.number().int().min(1).max(100_000_000),
  isActive: z.boolean(),
});

export const adminBoxSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  tagline: z.string().trim().max(80),
  description: z.string().trim().max(400),
  price: z.number().int().min(1).max(10_000_000),
  theme: z.string().max(20),
  isActive: z.boolean(),
  featured: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
  rewards: z
    .array(
      z.object({
        type: z.enum(["CARD", "CARD_BUNDLE", "COINS", "PACK_VOUCHER", "COLLECTIBLE"]),
        label: z.string().trim().min(1).max(80),
        weightPpm: ppm,
        coins: z.number().int().min(1).max(10_000_000).nullable(),
        packId: z.string().nullable(),
        collectibleId: z.string().nullable(),
        fallbackCoins: z.number().int().min(0).max(10_000_000).nullable(),
        cards: z.array(z.object({ cardId: id, quantity: z.number().int().min(1).max(20) })).max(20),
      }),
    )
    .min(1)
    .max(30),
});

export const adminSimulationSchema = z.object({
  packId: id,
  packs: z.union([z.literal(1_000), z.literal(10_000), z.literal(100_000)]),
});

export const adminDailyRewardsSchema = z.object({
  days: z
    .array(
      z.object({
        day: z.number().int().min(1).max(7),
        coins: z.number().int().min(0).max(1_000_000),
        xp: z.number().int().min(0).max(100_000),
        packId: z.string().nullable(),
        label: z.string().trim().min(1).max(60),
      }),
    )
    .length(7),
});

export const adminMissionSchema = z.object({
  title: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200),
  target: z.number().int().min(1).max(10_000_000),
  rewardCoins: z.number().int().min(0).max(1_000_000),
  rewardXp: z.number().int().min(0).max(100_000),
  isActive: z.boolean(),
});

export const adminSettingsSchema = z.object({
  economy: z.object({
    instantSellBps: z.number().int().min(0).max(10_000),
    marketplaceFeeBps: z.number().int().min(0).max(5_000),
    levelUpBaseReward: z.number().int().min(0).max(100_000),
    levelUpPerLevel: z.number().int().min(0).max(100_000),
  }),
  market: z.object({
    volatility: z.object(Object.fromEntries(RARITIES.map((r) => [r, z.number().min(0).max(0.5)])) as Record<
      (typeof RARITIES)[number],
      z.ZodNumber
    >),
    meanReversion: z.number().min(0).max(1),
    maxTickChange: z.number().min(0.001).max(0.5),
    floorFactor: z.number().min(0.05).max(1),
    ceilingFactor: z.number().min(1).max(20),
  }),
  activity: z.object({
    bigPullMinRarity: z.enum(RARITIES),
    bigPullMinValue: z.number().int().min(0).max(100_000_000),
  }),
});
