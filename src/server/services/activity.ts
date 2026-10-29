import type { ActivityType } from "@/generated/prisma/enums";
import type { RarityKey } from "@/lib/rarity";
import { prisma, type Tx } from "../db";
import { PUBLIC_USER_SELECT, publicIdentity } from "./privacy";

export async function recordActivity(
  tx: Tx,
  event: {
    type: ActivityType;
    userId?: string;
    cardId?: string;
    rarity?: RarityKey;
    value?: number;
    message: string;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
  },
) {
  await tx.activityEvent.create({
    data: {
      type: event.type,
      userId: event.userId,
      cardId: event.cardId,
      rarity: event.rarity,
      value: event.value,
      message: event.message,
      metadata: event.metadata as object | undefined,
      ...(event.createdAt ? { createdAt: event.createdAt } : {}),
    },
  });
}

export async function listActivity(opts: { limit?: number; types?: ActivityType[] } = {}) {
  const rows = await prisma.activityEvent.findMany({
    where: opts.types ? { type: { in: opts.types } } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(50, opts.limit ?? 20),
    select: {
      id: true,
      type: true,
      rarity: true,
      value: true,
      message: true,
      metadata: true,
      createdAt: true,
      user: { select: PUBLIC_USER_SELECT },
      card: {
        select: { id: true, name: true, number: true, rarity: true, energyType: true, dexNumber: true, imageUrl: true, variant: true, grade: true, set: { select: { name: true } } },
      },
    },
  });
  return rows.map((r) => ({
    ...r,
    // Private profiles appear anonymously in the public feed.
    user: r.user ? publicIdentity(r.user) : null,
  }));
}

export type ActivityItem = Awaited<ReturnType<typeof listActivity>>[number];
