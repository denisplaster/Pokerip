import { levelProgress } from "@/lib/levels";
import { prisma } from "../db";
import { AppError, conflict, notFound } from "../errors";
import { CARD_VIEW_SELECT, toCardView } from "./cards";
import { getFavorites } from "./collection";
import { getUserCollectibles } from "./mystery-boxes";
import { completedSetIds } from "./progression";
import { hashPassword, verifyPassword } from "./users";
import { AVATARS } from "@/lib/constants";

export async function getProfileStats(userId: string) {
  const [value, unique, total, biggest, sets, wallet] = await Promise.all([
    prisma.$queryRaw<{ v: bigint | null }[]>`SELECT SUM(c."currentValue") AS v FROM "UserCard" uc JOIN "Card" c ON c."id" = uc."cardId" WHERE uc."userId" = ${userId}`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT "cardId") AS n FROM "UserCard" WHERE "userId" = ${userId}`,
    prisma.userCard.count({ where: { userId } }),
    prisma.packOpeningReward.findFirst({
      where: { userId },
      orderBy: [{ value: "desc" }, { createdAt: "asc" }],
      select: { value: true, createdAt: true, card: { select: CARD_VIEW_SELECT } },
    }),
    completedSetIds(prisma, userId),
    prisma.wallet.findUnique({ where: { userId }, select: { balance: true } }),
  ]);
  return {
    collectionValue: Number(value[0]?.v ?? 0),
    uniqueCards: Number(unique[0]?.n ?? 0),
    totalCards: total,
    biggestPull: biggest ? { value: biggest.value, createdAt: biggest.createdAt.toISOString(), card: toCardView(biggest.card) } : null,
    setsCompleted: sets.length,
    balance: wallet?.balance ?? 0,
  };
}

export async function getProfile(username: string, viewerId: string | null) {
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" }, suspendedAt: null },
    select: {
      id: true,
      username: true,
      avatar: true,
      image: true,
      bio: true,
      level: true,
      xp: true,
      packsOpened: true,
      boxesOpened: true,
      loginStreak: true,
      createdAt: true,
      profileVisibility: true,
      isBot: true,
    },
  });
  if (!user) throw notFound("Collector");
  const isOwner = viewerId === user.id;
  const base = {
    username: user.username,
    avatar: user.avatar,
    image: user.image,
    level: user.level,
    isOwner,
    isBot: user.isBot,
    profileVisibility: user.profileVisibility,
  };
  if (user.profileVisibility === "PRIVATE" && !isOwner) return { ...base, private: true as const };

  const [stats, achievements, favorites, topCards, collectibles] = await Promise.all([
    getProfileStats(user.id),
    prisma.userAchievement.findMany({
      where: { userId: user.id },
      orderBy: { unlockedAt: "desc" },
      select: { unlockedAt: true, achievement: { select: { key: true, name: true, description: true, icon: true, tier: true } } },
    }),
    getFavorites(user.id, 8),
    prisma.$queryRaw<{ cardId: string; n: bigint }[]>`
      SELECT uc."cardId", COUNT(*) AS n FROM "UserCard" uc JOIN "Card" c ON c."id" = uc."cardId"
      WHERE uc."userId" = ${user.id} GROUP BY uc."cardId", c."currentValue" ORDER BY c."currentValue" DESC LIMIT 8`,
    getUserCollectibles(user.id),
  ]);
  const showcaseCards = topCards.length
    ? await prisma.card.findMany({ where: { id: { in: topCards.map((t) => t.cardId) } }, select: CARD_VIEW_SELECT })
    : [];
  const order = new Map(topCards.map((t, i) => [t.cardId, i]));
  showcaseCards.sort((a, b) => order.get(a.id)! - order.get(b.id)!);

  return {
    ...base,
    private: false as const,
    bio: user.bio,
    xp: user.xp,
    progress: levelProgress(user.xp),
    packsOpened: user.packsOpened,
    boxesOpened: user.boxesOpened,
    loginStreak: user.loginStreak,
    joinedAt: user.createdAt.toISOString(),
    stats,
    achievements: achievements.map((a) => ({ ...a.achievement, unlockedAt: a.unlockedAt.toISOString() })),
    favorites,
    showcase: showcaseCards.map(toCardView),
    collectibles,
  };
}

export type ProfileData = Awaited<ReturnType<typeof getProfile>>;

export async function updateProfile(
  userId: string,
  input: { username?: string; bio?: string; avatar?: string; profileVisibility?: "PUBLIC" | "PRIVATE" },
) {
  if (input.avatar && !AVATARS.some((a) => a.key === input.avatar)) throw new AppError("VALIDATION", "Unknown avatar.");
  if (input.username) {
    const taken = await prisma.user.findFirst({
      where: { username: { equals: input.username, mode: "insensitive" }, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) throw conflict("That username is taken.");
  }
  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: { username: true, bio: true, avatar: true, profileVisibility: true },
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!user.passwordHash) throw new AppError("BAD_REQUEST", "This account signs in with an external provider and has no password.");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new AppError("VALIDATION", "Current password is incorrect.");
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  return { ok: true };
}

export async function getAccountSettings(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      username: true,
      email: true,
      bio: true,
      avatar: true,
      profileVisibility: true,
      createdAt: true,
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
  });
  const { passwordHash, ...rest } = user;
  return { ...rest, hasPassword: Boolean(passwordHash), createdAt: user.createdAt.toISOString() };
}
