import type { AchievementMetric } from "@/generated/prisma/enums";
import { periodKey, periodResetsAt } from "@/lib/dates";
import { prisma, withTransaction, type Tx } from "../db";
import { conflict, notFound } from "../errors";
import { completedSetIds, grantXp, type Notices } from "./progression";
import { applyWalletChange, lockWallets } from "./wallet";

export async function getMissions(userId: string, now = new Date()) {
  const missions = await prisma.mission.findMany({ where: { isActive: true }, orderBy: [{ period: "asc" }, { sortOrder: "asc" }] });
  const keys = [...new Set(missions.map((m) => periodKey(m.period, now)))];
  const progress = await prisma.userMission.findMany({ where: { userId, periodKey: { in: keys } } });
  const byMission = new Map(progress.map((p) => [`${p.missionId}:${p.periodKey}`, p]));
  return missions.map((m) => {
    const key = periodKey(m.period, now);
    const p = byMission.get(`${m.id}:${key}`);
    return {
      id: m.id,
      key: m.key,
      title: m.title,
      description: m.description,
      type: m.type,
      period: m.period,
      target: m.target,
      rewardCoins: m.rewardCoins,
      rewardXp: m.rewardXp,
      progress: Math.min(m.target, p?.progress ?? 0),
      completed: Boolean(p?.completedAt),
      claimed: Boolean(p?.claimedAt),
      resetsAt: periodResetsAt(m.period, now)?.toISOString() ?? null,
    };
  });
}

export type MissionView = Awaited<ReturnType<typeof getMissions>>[number];

export async function claimMission(userId: string, missionId: string, now = new Date()) {
  return withTransaction(async (tx) => {
    const notices: Notices = [];
    const mission = await tx.mission.findUnique({ where: { id: missionId } });
    if (!mission || !mission.isActive) throw notFound("Mission");
    const key = periodKey(mission.period, now);
    await lockWallets(tx, [userId]);
    const claimed = await tx.userMission.updateMany({
      where: { userId, missionId, periodKey: key, completedAt: { not: null }, claimedAt: null },
      data: { claimedAt: now },
    });
    if (!claimed.count) throw conflict("This mission isn't ready to claim (or was already claimed).");
    if (mission.rewardCoins > 0) {
      await applyWalletChange(tx, {
        userId,
        amount: mission.rewardCoins,
        type: "MISSION_REWARD",
        description: `Mission: ${mission.title}`,
        idempotencyKey: `mission:${userId}:${missionId}:${key}`,
      });
    }
    if (mission.rewardXp > 0) await grantXp(tx, userId, mission.rewardXp, notices);
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId }, select: { balance: true } });
    return { missionId, coins: mission.rewardCoins, xp: mission.rewardXp, balance: wallet.balance, notices };
  });
}

/** Current value of each achievement metric for display (progress bars). */
export async function achievementMetrics(db: Tx | typeof prisma, userId: string): Promise<Record<AchievementMetric, number>> {
  const [user, unique, total, value, sets, chase, secret, sales, biggest] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { packsOpened: true, level: true, loginStreak: true } }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT "cardId") AS n FROM "UserCard" WHERE "userId" = ${userId}`,
    db.userCard.count({ where: { userId } }),
    db.$queryRaw<{ v: bigint | null }[]>`SELECT SUM(c."currentValue") AS v FROM "UserCard" uc JOIN "Card" c ON c."id" = uc."cardId" WHERE uc."userId" = ${userId}`,
    completedSetIds(db, userId),
    db.packOpeningReward.count({ where: { userId, rarity: "CHASE" } }),
    db.packOpeningReward.count({ where: { userId, rarity: "SECRET_RARE" } }),
    db.marketplaceTransaction.count({ where: { sellerId: userId } }),
    db.packOpeningReward.aggregate({ where: { userId }, _max: { value: true } }),
  ]);
  return {
    PACKS_OPENED: user.packsOpened,
    UNIQUE_CARDS: Number(unique[0]?.n ?? 0),
    TOTAL_CARDS: total,
    COLLECTION_VALUE: Number(value[0]?.v ?? 0),
    SETS_COMPLETED: sets.length,
    CHASE_PULLS: chase,
    SECRET_PULLS: secret,
    MARKET_SALES: sales,
    LEVEL: user.level,
    LOGIN_STREAK: user.loginStreak,
    BIGGEST_PULL: biggest._max.value ?? 0,
  };
}

export async function getAchievements(userId: string | null) {
  const [achievements, unlocked, metrics] = await Promise.all([
    prisma.achievement.findMany({ orderBy: [{ sortOrder: "asc" }, { threshold: "asc" }] }),
    userId ? prisma.userAchievement.findMany({ where: { userId } }) : Promise.resolve([]),
    userId ? achievementMetrics(prisma, userId) : Promise.resolve(null),
  ]);
  const byId = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));
  return achievements.map((a) => ({
    id: a.id,
    key: a.key,
    name: a.name,
    description: a.description,
    icon: a.icon,
    tier: a.tier,
    metric: a.metric,
    threshold: a.threshold,
    rewardCoins: a.rewardCoins,
    rewardXp: a.rewardXp,
    unlockedAt: byId.get(a.id)?.toISOString() ?? null,
    current: metrics ? Math.min(a.threshold, metrics[a.metric]) : 0,
  }));
}

export type AchievementView = Awaited<ReturnType<typeof getAchievements>>[number];
