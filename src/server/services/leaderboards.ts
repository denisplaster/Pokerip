import { Prisma } from "@/generated/prisma/client";
import { periodStart, type LeaderboardPeriod } from "@/lib/dates";
import type { RarityKey } from "@/lib/rarity";
import { prisma } from "../db";
import { CARD_VIEW_SELECT, toCardView, type CardView } from "./cards";

export type LeaderboardCategory = "collection_value" | "biggest_pull" | "cards_collected" | "unique_cards" | "level" | "sets_completed";

/** Categories that are point-in-time snapshots and therefore only support "all". */
export const SNAPSHOT_CATEGORIES: LeaderboardCategory[] = ["collection_value", "unique_cards", "level", "sets_completed"];

interface RankRow {
  userId: string;
  score: bigint | number;
  rank: bigint | number;
  cardId?: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  score: number;
  user: { id: string | null; username: string; avatar: string; image: string | null; level: number; isPublic: boolean; isBot: boolean };
  card?: CardView | null;
  isViewer: boolean;
}

function rankingQuery(category: LeaderboardCategory, since: Date | null): Prisma.Sql {
  const sinceFilter = since ? Prisma.sql`AND r."createdAt" >= ${since}` : Prisma.empty;
  switch (category) {
    case "collection_value":
      return Prisma.sql`
        SELECT uc."userId", SUM(c."currentValue")::bigint AS score
        FROM "UserCard" uc JOIN "Card" c ON c."id" = uc."cardId"
        GROUP BY uc."userId"`;
    case "unique_cards":
      return Prisma.sql`SELECT "userId", COUNT(DISTINCT "cardId")::bigint AS score FROM "UserCard" GROUP BY "userId"`;
    case "level":
      return Prisma.sql`SELECT "id" AS "userId", ("level"::bigint * 100000000 + "xp") AS score FROM "User" WHERE "xp" > 0`;
    case "cards_collected":
      return Prisma.sql`
        SELECT r."userId", COUNT(*)::bigint AS score FROM "PackOpeningReward" r WHERE true ${sinceFilter} GROUP BY r."userId"`;
    case "biggest_pull":
      return Prisma.sql`
        SELECT DISTINCT ON (r."userId") r."userId", r."value"::bigint AS score, r."cardId"
        FROM "PackOpeningReward" r WHERE true ${sinceFilter}
        ORDER BY r."userId", r."value" DESC, r."createdAt" ASC`;
    case "sets_completed":
      return Prisma.sql`
        SELECT o."userId", COUNT(*)::bigint AS score FROM (
          SELECT uc."userId", c."setId", COUNT(DISTINCT uc."cardId") AS owned
          FROM "UserCard" uc JOIN "Card" c ON c."id" = uc."cardId" AND c."isActive"
          GROUP BY uc."userId", c."setId"
        ) o
        JOIN (SELECT "setId", COUNT(*) AS total FROM "Card" WHERE "isActive" GROUP BY "setId") t ON t."setId" = o."setId"
        WHERE o.owned >= t.total
        GROUP BY o."userId"`;
  }
}

export async function getLeaderboard(category: LeaderboardCategory, period: LeaderboardPeriod, viewerId?: string | null, limit = 50) {
  const effectivePeriod = SNAPSHOT_CATEGORIES.includes(category) ? "all" : period;
  const since = periodStart(effectivePeriod);
  const base = rankingQuery(category, since);
  const hasCard = category === "biggest_pull";
  const rows = await prisma.$queryRaw<RankRow[]>`
    WITH scores AS (${base}),
    ranked AS (
      SELECT s."userId", s.score, ${hasCard ? Prisma.sql`s."cardId"` : Prisma.sql`NULL::text AS "cardId"`},
             RANK() OVER (ORDER BY s.score DESC) AS rank
      FROM scores s JOIN "User" u ON u."id" = s."userId"
      WHERE u."suspendedAt" IS NULL AND s.score > 0
    )
    SELECT * FROM ranked
    WHERE rank <= ${limit}::int ${viewerId ? Prisma.sql`OR "userId" = ${viewerId}` : Prisma.empty}
    ORDER BY rank ASC, "userId" ASC
    LIMIT ${limit + 1}::int`;

  const userIds = rows.map((r) => r.userId);
  const cardIds = rows.map((r) => r.cardId).filter((id): id is string => Boolean(id));
  const [users, cards] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, avatar: true, image: true, level: true, profileVisibility: true, isBot: true },
    }),
    cardIds.length ? prisma.card.findMany({ where: { id: { in: cardIds } }, select: CARD_VIEW_SELECT }) : Promise.resolve([]),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const cardMap = new Map(cards.map((c) => [c.id, toCardView(c)]));

  const entries: LeaderboardEntry[] = rows.map((r) => {
    const u = userMap.get(r.userId)!;
    const isViewer = r.userId === viewerId;
    const isPublic = u.profileVisibility === "PUBLIC" || isViewer;
    const score = category === "level" ? Math.floor(Number(r.score) / 100_000_000) : Number(r.score);
    return {
      rank: Number(r.rank),
      score,
      user: isPublic
        ? { id: u.id, username: u.username, avatar: u.avatar, image: u.image, level: u.level, isPublic: true, isBot: u.isBot }
        : { id: null, username: "Anonymous collector", avatar: "lugia", image: null, level: u.level, isPublic: false, isBot: u.isBot },
      card: r.cardId ? (cardMap.get(r.cardId) ?? null) : null,
      isViewer,
    };
  });
  const top = entries.filter((e) => e.rank <= limit).slice(0, limit);
  const viewer = entries.find((e) => e.isViewer) ?? null;
  return { category, period: effectivePeriod, entries: top, viewer };
}

export type LeaderboardData = Awaited<ReturnType<typeof getLeaderboard>>;

export async function getTopPulls(limit = 10, sinceDays = 7) {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const rows = await prisma.packOpeningReward.findMany({
    where: { createdAt: { gte: since }, user: { suspendedAt: null } },
    orderBy: [{ value: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      value: true,
      rarity: true,
      createdAt: true,
      card: { select: CARD_VIEW_SELECT },
      user: { select: { username: true, avatar: true, profileVisibility: true } },
      opening: { select: { pack: { select: { name: true, slug: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    value: r.value,
    rarity: r.rarity as RarityKey,
    createdAt: r.createdAt.toISOString(),
    card: toCardView(r.card),
    pack: r.opening.pack,
    user: r.user.profileVisibility === "PUBLIC" ? { username: r.user.username, avatar: r.user.avatar, isPublic: true } : { username: "Anonymous collector", avatar: "lugia", isPublic: false },
  }));
}
