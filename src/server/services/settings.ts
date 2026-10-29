import {
  DEFAULT_ACTIVITY,
  DEFAULT_ECONOMY,
  DEFAULT_MARKET,
  type ActivitySettings,
  type EconomySettings,
  type MarketSettings,
} from "@/lib/constants";
import { prisma, type Tx } from "../db";

export interface SystemSettings {
  economy: EconomySettings;
  market: MarketSettings;
  activity: ActivitySettings;
}

const DEFAULTS: SystemSettings = { economy: DEFAULT_ECONOMY, market: DEFAULT_MARKET, activity: DEFAULT_ACTIVITY };
const TTL_MS = 15_000;
let cache: { value: SystemSettings; at: number } | null = null;

/** Reads runtime settings (cached briefly), falling back to defaults for missing keys. */
export async function getSettings(db: Tx | typeof prisma = prisma): Promise<SystemSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await db.systemSetting.findMany({ where: { key: { in: ["economy", "market", "activity"] } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const value: SystemSettings = {
    economy: { ...DEFAULTS.economy, ...((map.get("economy") as object) ?? {}) },
    market: {
      ...DEFAULTS.market,
      ...((map.get("market") as object) ?? {}),
      volatility: { ...DEFAULTS.market.volatility, ...(((map.get("market") as { volatility?: object }) ?? {}).volatility ?? {}) },
    },
    activity: { ...DEFAULTS.activity, ...((map.get("activity") as object) ?? {}) },
  };
  cache = { value, at: Date.now() };
  return value;
}

export async function saveSettings(tx: Tx, settings: SystemSettings, adminId: string) {
  for (const key of ["economy", "market", "activity"] as const) {
    await tx.systemSetting.upsert({
      where: { key },
      create: { key, value: settings[key] as object, updatedBy: adminId },
      update: { value: settings[key] as object, updatedBy: adminId },
    });
  }
  invalidateSettingsCache();
}

export function invalidateSettingsCache() {
  cache = null;
}
