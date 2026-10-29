/**
 * Odds versioning. Every change to a pack's odds or pool (or a mystery box's
 * rewards) writes a new immutable OddsVersion. Draws always use the latest
 * version, and each opening stores the version it used, so results can be
 * replayed and nobody can silently change odds.
 */
import { createHash } from "node:crypto";
import { RARITIES, type RarityKey } from "@/lib/rarity";
import {
  buildPackSnapshot,
  compilePackOdds,
  OddsConfigError,
  validatePackSnapshot,
  validateWeightedOutcomes,
  type CompiledPackOdds,
  type PackOddsSnapshot,
} from "@/lib/probability";
import { AppError } from "../errors";
import { prisma, type Tx } from "../db";

export function hashSnapshot(data: unknown) {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

/** Builds a snapshot from the pack's current odds/pool tables. */
export async function readPackConfigSnapshot(tx: Tx, packId: string): Promise<PackOddsSnapshot> {
  const pack = await tx.pack.findUnique({
    where: { id: packId },
    select: {
      cardsPerPack: true,
      odds: { select: { rarity: true, weightPpm: true } },
      pool: { where: { card: { isActive: true } }, select: { cardId: true, weight: true, card: { select: { rarity: true } } } },
    },
  });
  if (!pack) throw new AppError("NOT_FOUND", "Pack not found.");
  return buildPackSnapshot(
    pack.cardsPerPack,
    RARITIES.map((r) => ({ rarity: r, weightPpm: pack.odds.find((o) => o.rarity === r)?.weightPpm ?? 0 })),
    pack.pool.map((p) => ({ cardId: p.cardId, rarity: p.card.rarity as RarityKey, weight: p.weight })),
  );
}

/**
 * Validates the pack's current configuration and records a new OddsVersion if it
 * differs from the latest one. Returns the latest version.
 */
export async function publishPackOdds(tx: Tx, packId: string, createdBy?: string) {
  const snapshot = await readPackConfigSnapshot(tx, packId);
  const problems = validatePackSnapshot(snapshot);
  if (problems.length) throw new OddsConfigError(problems);
  const hash = hashSnapshot(snapshot);
  const latest = await tx.oddsVersion.findFirst({ where: { packId }, orderBy: { version: "desc" } });
  if (latest?.hash === hash) return latest;
  return tx.oddsVersion.create({
    data: {
      kind: "PACK",
      packId,
      version: (latest?.version ?? 0) + 1,
      hash,
      data: snapshot as object,
      createdBy,
    },
  });
}

export interface BoxSnapshotReward {
  id: string;
  weightPpm: number;
  type: string;
  label: string;
}

export interface BoxOddsSnapshot {
  schema: 1;
  rewards: BoxSnapshotReward[];
}

export async function publishBoxOdds(tx: Tx, boxId: string, createdBy?: string) {
  // Retired rewards (weight 0) stay in the table so past openings remain linked,
  // but are excluded from the published snapshot.
  const rewards = await tx.mysteryBoxReward.findMany({
    where: { boxId, weightPpm: { gt: 0 } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, weightPpm: true, type: true, label: true },
  });
  const snapshot: BoxOddsSnapshot = { schema: 1, rewards };
  const problems = validateWeightedOutcomes(rewards);
  if (problems.length) throw new OddsConfigError(problems);
  const hash = hashSnapshot(snapshot);
  const latest = await tx.oddsVersion.findFirst({ where: { boxId }, orderBy: { version: "desc" } });
  if (latest?.hash === hash) return latest;
  return tx.oddsVersion.create({
    data: { kind: "MYSTERY_BOX", boxId, version: (latest?.version ?? 0) + 1, hash, data: snapshot as object, createdBy },
  });
}

// Compiled odds are immutable per version id, so they can be cached forever.
const compiledCache = new Map<string, CompiledPackOdds>();

export async function getLatestPackOdds(packId: string, db: Tx | typeof prisma = prisma) {
  const version = await db.oddsVersion.findFirst({ where: { packId }, orderBy: { version: "desc" } });
  if (!version) throw new AppError("UNAVAILABLE", "This pack has no published odds yet.");
  let compiled = compiledCache.get(version.id);
  if (!compiled) {
    compiled = compilePackOdds(version.data as unknown as PackOddsSnapshot);
    if (compiledCache.size > 200) compiledCache.clear();
    compiledCache.set(version.id, compiled);
  }
  return { version, compiled };
}

export async function getLatestBoxOdds(boxId: string, db: Tx | typeof prisma = prisma) {
  const version = await db.oddsVersion.findFirst({ where: { boxId }, orderBy: { version: "desc" } });
  if (!version) throw new AppError("UNAVAILABLE", "This box has no published odds yet.");
  return { version, snapshot: version.data as unknown as BoxOddsSnapshot };
}
