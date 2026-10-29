import { nextUtcMidnight, utcDateKey } from "@/lib/dates";
import { cycleDay, nextStreak } from "@/lib/streak";
import { prisma, withTransaction } from "../db";
import { conflict } from "../errors";
import { checkAchievements, grantXp, trackEarnings, type Notices } from "./progression";
import { applyWalletChange, lockWallets } from "./wallet";

export async function getDailyStatus(userId: string, now = new Date()) {
  const [user, rewards, recent] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { loginStreak: true, lastDailyClaimAt: true } }),
    prisma.dailyReward.findMany({ orderBy: { day: "asc" }, include: { pack: { select: { id: true, name: true, slug: true, theme: true } } } }),
    prisma.dailyRewardClaim.findMany({ where: { userId }, orderBy: { claimedAt: "desc" }, take: 7 }),
  ]);
  const next = nextStreak(user.lastDailyClaimAt, user.loginStreak, now);
  // If the streak is broken, the visible streak is 0 until the next claim.
  const activeStreak = next.claimedToday ? user.loginStreak : next.streak - 1;
  return {
    streak: activeStreak,
    claimedToday: next.claimedToday,
    nextDay: next.claimedToday ? cycleDay(user.loginStreak + 1) : cycleDay(next.streak),
    todayDay: next.claimedToday ? cycleDay(user.loginStreak) : cycleDay(next.streak),
    resetsAt: nextUtcMidnight(now).toISOString(),
    rewards: rewards.map((r) => ({ day: r.day, coins: r.coins, xp: r.xp, label: r.label, pack: r.pack })),
    recentClaims: recent.map((c) => ({ dateKey: c.dateKey, day: c.day, coins: c.coins, claimedAt: c.claimedAt.toISOString() })),
  };
}

export async function claimDailyReward(userId: string, now = new Date()) {
  return withTransaction(async (tx) => {
    const notices: Notices = [];
    await lockWallets(tx, [userId]);
    const [user] = await tx.$queryRaw<{ loginStreak: number; lastDailyClaimAt: Date | null }[]>`
      SELECT "loginStreak", "lastDailyClaimAt" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const next = nextStreak(user.lastDailyClaimAt, user.loginStreak, now);
    if (next.claimedToday) throw conflict("You've already claimed today's reward. Come back after the daily reset!");

    const day = cycleDay(next.streak);
    const reward = await tx.dailyReward.findUniqueOrThrow({ where: { day }, include: { pack: true } });
    const dateKey = utcDateKey(now);
    // The unique (userId, dateKey) constraint is a second line of defence against double claims.
    const claim = await tx.dailyRewardClaim.create({ data: { userId, dateKey, day, streak: next.streak, coins: reward.coins, claimedAt: now } });

    let balance: number | null = null;
    if (reward.coins > 0) {
      const res = await applyWalletChange(tx, {
        userId,
        amount: reward.coins,
        type: "DAILY_REWARD",
        description: `Daily reward — day ${day}`,
        idempotencyKey: `daily:${userId}:${dateKey}`,
      });
      balance = res.balance;
      await trackEarnings(tx, userId, reward.coins, notices);
    }
    let voucher = null;
    if (reward.pack) {
      voucher = await tx.packVoucher.create({ data: { userId, packId: reward.pack.id, source: "DAILY_REWARD" } });
      await tx.dailyRewardClaim.update({ where: { id: claim.id }, data: { voucherId: voucher.id } });
    }
    await tx.user.update({ where: { id: userId }, data: { loginStreak: next.streak, lastDailyClaimAt: now } });
    await checkAchievements(tx, userId, ["LOGIN_STREAK"], notices);
    if (reward.xp > 0) await grantXp(tx, userId, reward.xp, notices);
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId }, select: { balance: true } });
    return {
      day,
      streak: next.streak,
      coins: reward.coins,
      xp: reward.xp,
      pack: reward.pack ? { id: reward.pack.id, name: reward.pack.name, slug: reward.pack.slug } : null,
      balance: balance === null ? wallet.balance : wallet.balance,
      notices,
    };
  });
}
