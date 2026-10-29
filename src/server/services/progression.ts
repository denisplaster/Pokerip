/**
 * XP, levels, missions, achievements and set-completion bookkeeping. These run
 * inside the caller's transaction so rewards are granted atomically with the
 * action that earned them.
 *
 * Lock ordering convention (prevents deadlocks): Wallet rows before User rows.
 */
import { randomUUID } from "node:crypto";
import type { AchievementMetric, MissionType } from "@/generated/prisma/enums";
import { periodKey } from "@/lib/dates";
import { levelForXp, levelUpReward } from "@/lib/levels";
import type { ProgressNotice } from "@/lib/notices";
import type { Tx } from "../db";
import { recordActivity } from "./activity";
import { getSettings } from "./settings";
import { applyWalletChange, lockWallets } from "./wallet";

export type Notices = ProgressNotice[];

// ── XP & levels ──────────────────────────────────────────────────────────────

export async function grantXp(tx: Tx, userId: string, amount: number, notices: Notices) {
  if (amount <= 0) return;
  await lockWallets(tx, [userId]);
  const [row] = await tx.$queryRaw<{ xp: number; level: number }[]>`
    SELECT "xp", "level" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  if (!row) return;
  const xp = row.xp + amount;
  const newLevel = levelForXp(xp);
  await tx.user.update({ where: { id: userId }, data: { xp, level: Math.max(row.level, newLevel) } });
  if (newLevel <= row.level) return;

  const { economy } = await getSettings(tx);
  for (let level = row.level + 1; level <= newLevel; level++) {
    const coins = levelUpReward(level, economy.levelUpBaseReward, economy.levelUpPerLevel);
    await applyWalletChange(tx, {
      userId,
      amount: coins,
      type: "LEVEL_UP_REWARD",
      description: `Level ${level} reward`,
      idempotencyKey: `level:${userId}:${level}`,
    });
    notices.push({ kind: "LEVEL_UP", title: `Level ${level} reached!`, description: `+${coins.toLocaleString()} RC level-up reward`, coins });
    if (level % 5 === 0) {
      await recordActivity(tx, { type: "LEVEL_UP", userId, value: level, message: `reached level ${level}` });
    }
  }
  await checkAchievements(tx, userId, ["LEVEL"], notices);
}

// ── Missions ─────────────────────────────────────────────────────────────────

/**
 * Advances every active mission of `type`. `mode: "max"` sets progress to at
 * least `amount` (for state-based missions such as completing a set).
 */
export async function trackMission(
  tx: Tx,
  userId: string,
  type: MissionType,
  amount: number,
  notices: Notices,
  opts: { mode?: "increment" | "max"; now?: Date } = {},
) {
  if (amount <= 0) return;
  const now = opts.now ?? new Date();
  const missions = await tx.mission.findMany({ where: { type, isActive: true } });
  for (const mission of missions) {
    const key = periodKey(mission.period, now);
    const rows =
      opts.mode === "max"
        ? await tx.$queryRaw<{ progress: number; completedAt: Date | null }[]>`
            INSERT INTO "UserMission" ("id", "userId", "missionId", "periodKey", "progress", "updatedAt")
            VALUES (${randomUUID()}, ${userId}, ${mission.id}, ${key}, LEAST(${amount}::int, ${mission.target}::int), NOW())
            ON CONFLICT ("userId", "missionId", "periodKey")
            DO UPDATE SET "progress" = GREATEST("UserMission"."progress", LEAST(${amount}::int, ${mission.target}::int)), "updatedAt" = NOW()
            RETURNING "progress", "completedAt"`
        : await tx.$queryRaw<{ progress: number; completedAt: Date | null }[]>`
            INSERT INTO "UserMission" ("id", "userId", "missionId", "periodKey", "progress", "updatedAt")
            VALUES (${randomUUID()}, ${userId}, ${mission.id}, ${key}, LEAST(${amount}::int, ${mission.target}::int), NOW())
            ON CONFLICT ("userId", "missionId", "periodKey")
            DO UPDATE SET "progress" = LEAST("UserMission"."progress" + ${amount}::int, ${mission.target}::int), "updatedAt" = NOW()
            RETURNING "progress", "completedAt"`;
    const row = rows[0];
    if (row && row.progress >= mission.target && !row.completedAt) {
      const updated = await tx.userMission.updateMany({
        where: { userId, missionId: mission.id, periodKey: key, completedAt: null },
        data: { completedAt: now },
      });
      if (updated.count) {
        notices.push({
          kind: "MISSION_COMPLETE",
          title: `Mission complete: ${mission.title}`,
          description: `Claim ${mission.rewardCoins.toLocaleString()} RC on the Rewards page`,
          coins: mission.rewardCoins,
        });
      }
    }
  }
}

/** Earnings that count towards "earn RC" missions (not grants, refunds or rewards for missions). */
export async function trackEarnings(tx: Tx, userId: string, amount: number, notices: Notices) {
  await trackMission(tx, userId, "EARN_COINS", amount, notices);
}

// ── Collection state ─────────────────────────────────────────────────────────

export async function completedSetIds(tx: Tx, userId: string): Promise<string[]> {
  const rows = await tx.$queryRaw<{ setId: string }[]>`
    SELECT c."setId"
    FROM "Card" c
    LEFT JOIN (SELECT DISTINCT "cardId" FROM "UserCard" WHERE "userId" = ${userId}) o ON o."cardId" = c."id"
    WHERE c."isActive" = true
    GROUP BY c."setId"
    HAVING COUNT(*) = COUNT(o."cardId")`;
  return rows.map((r) => r.setId);
}

/** Returns which of `cardIds` the user already owns (used to detect new uniques). */
export async function ownedCardIds(tx: Tx, userId: string, cardIds: string[]) {
  if (!cardIds.length) return new Set<string>();
  const rows = await tx.userCard.findMany({
    where: { userId, cardId: { in: [...new Set(cardIds)] } },
    distinct: ["cardId"],
    select: { cardId: true },
  });
  return new Set(rows.map((r) => r.cardId));
}

/**
 * Bookkeeping after cards enter a collection: unique-card missions, newly
 * completed sets and collection achievements.
 */
export async function afterCardsAcquired(
  tx: Tx,
  userId: string,
  acquiredCardIds: string[],
  previouslyOwned: Set<string>,
  notices: Notices,
  extraMetrics: AchievementMetric[] = [],
) {
  const newUnique = [...new Set(acquiredCardIds)].filter((id) => !previouslyOwned.has(id));
  if (newUnique.length) {
    await trackMission(tx, userId, "COLLECT_UNIQUE", newUnique.length, notices);
    const touchedSets = await tx.card.findMany({ where: { id: { in: newUnique } }, distinct: ["setId"], select: { setId: true } });
    const completed = new Set(await completedSetIds(tx, userId));
    const newlyCompleted = touchedSets.filter((s) => completed.has(s.setId));
    if (newlyCompleted.length) {
      const sets = await tx.cardSet.findMany({ where: { id: { in: newlyCompleted.map((s) => s.setId) } }, select: { name: true } });
      for (const set of sets) {
        notices.push({ kind: "SET_COMPLETE", title: `Set complete: ${set.name}!`, description: "Every card in the set is now in your collection." });
        await recordActivity(tx, { type: "SET_COMPLETED", userId, message: `completed ${set.name}` });
      }
    }
    await trackMission(tx, userId, "COMPLETE_SET", completed.size, notices, { mode: "max" });
  }
  await checkAchievements(tx, userId, ["UNIQUE_CARDS", "TOTAL_CARDS", "COLLECTION_VALUE", "SETS_COMPLETED", ...extraMetrics], notices);
}

// ── Achievements ─────────────────────────────────────────────────────────────

async function computeMetric(tx: Tx, userId: string, metric: AchievementMetric): Promise<number> {
  switch (metric) {
    case "PACKS_OPENED":
    case "LEVEL":
    case "LOGIN_STREAK": {
      const u = await tx.user.findUnique({ where: { id: userId }, select: { packsOpened: true, level: true, loginStreak: true } });
      if (!u) return 0;
      return metric === "PACKS_OPENED" ? u.packsOpened : metric === "LEVEL" ? u.level : u.loginStreak;
    }
    case "UNIQUE_CARDS": {
      const [r] = await tx.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT "cardId") AS n FROM "UserCard" WHERE "userId" = ${userId}`;
      return Number(r?.n ?? 0);
    }
    case "TOTAL_CARDS":
      return tx.userCard.count({ where: { userId } });
    case "COLLECTION_VALUE": {
      const [r] = await tx.$queryRaw<{ v: bigint | null }[]>`
        SELECT SUM(c."currentValue") AS v FROM "UserCard" uc JOIN "Card" c ON c."id" = uc."cardId" WHERE uc."userId" = ${userId}`;
      return Number(r?.v ?? 0);
    }
    case "SETS_COMPLETED":
      return (await completedSetIds(tx, userId)).length;
    case "CHASE_PULLS":
      return tx.packOpeningReward.count({ where: { userId, rarity: "CHASE" } });
    case "SECRET_PULLS":
      return tx.packOpeningReward.count({ where: { userId, rarity: "SECRET_RARE" } });
    case "MARKET_SALES":
      return tx.marketplaceTransaction.count({ where: { sellerId: userId } });
    case "BIGGEST_PULL": {
      const r = await tx.packOpeningReward.aggregate({ where: { userId }, _max: { value: true } });
      return r._max.value ?? 0;
    }
  }
}

export async function checkAchievements(tx: Tx, userId: string, metrics: AchievementMetric[], notices: Notices) {
  const unique = [...new Set(metrics)];
  const candidates = await tx.achievement.findMany({
    where: { metric: { in: unique }, users: { none: { userId } } },
    orderBy: { threshold: "asc" },
  });
  if (!candidates.length) return;
  const values = new Map<AchievementMetric, number>();
  for (const metric of new Set(candidates.map((c) => c.metric))) values.set(metric, await computeMetric(tx, userId, metric));

  for (const achievement of candidates) {
    if ((values.get(achievement.metric) ?? 0) < achievement.threshold) continue;
    const created = await tx.userAchievement.createMany({
      data: [{ userId, achievementId: achievement.id }],
      skipDuplicates: true,
    });
    if (!created.count) continue;
    if (achievement.rewardCoins > 0) {
      await applyWalletChange(tx, {
        userId,
        amount: achievement.rewardCoins,
        type: "ACHIEVEMENT_REWARD",
        description: `Achievement: ${achievement.name}`,
        idempotencyKey: `achievement:${userId}:${achievement.id}`,
      });
    }
    notices.push({
      kind: "ACHIEVEMENT",
      title: `Achievement unlocked: ${achievement.name}`,
      description: achievement.rewardCoins ? `${achievement.description} +${achievement.rewardCoins.toLocaleString()} RC` : achievement.description,
      coins: achievement.rewardCoins,
      icon: achievement.icon,
      tier: achievement.tier,
    });
    if (achievement.tier === "GOLD" || achievement.tier === "PLATINUM") {
      await recordActivity(tx, {
        type: "ACHIEVEMENT_UNLOCKED",
        userId,
        message: `unlocked ${achievement.name}`,
        metadata: { tier: achievement.tier, icon: achievement.icon },
      });
    }
    if (achievement.rewardXp > 0) await grantXp(tx, userId, achievement.rewardXp, notices);
  }
}
