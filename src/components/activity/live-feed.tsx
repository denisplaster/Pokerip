"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Award, ChevronsUp, Gift, Library, Radio, Store } from "lucide-react";
import Link from "next/link";
import { RC } from "@/components/common/coin-icon";
import { PokeCard } from "@/components/cards/poke-card";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { UserAvatar } from "@/components/common/user-avatar";
import { api } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import type { RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/server/services/activity";

const TYPE_ICON = {
  BIG_PULL: null,
  MYSTERY_BOX_WIN: Gift,
  ACHIEVEMENT_UNLOCKED: Award,
  LEVEL_UP: ChevronsUp,
  MARKETPLACE_SALE: Store,
  SET_COMPLETED: Library,
} as const;

/** Live activity feed of notable pulls and milestones (polls every few seconds). */
export function LiveFeed({ initial, type = "all", limit = 12, className }: { initial?: ActivityItem[]; type?: "all" | "pulls"; limit?: number; className?: string }) {
  const { data } = useQuery({
    queryKey: ["activity", type, limit],
    queryFn: () => api<{ items: ActivityItem[] }>(`/api/activity?type=${type}&limit=${limit}`),
    initialData: initial ? { items: initial } : undefined,
    refetchInterval: 6_000,
    refetchOnWindowFocus: true,
  });
  const items = data?.items ?? [];
  return (
    <div className={cn("surface rounded-2xl border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="flex items-center gap-2 font-display font-semibold">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
          </span>
          Live activity
        </p>
        <Radio className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <ul className="divide-y" aria-live="polite" aria-relevant="additions">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const Icon = TYPE_ICON[item.type];
            return (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, x: -16, backgroundColor: "rgba(139,92,246,0.18)" }}
                animate={{ opacity: 1, x: 0, backgroundColor: "rgba(139,92,246,0)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                {item.card ? (
                  <Link href={`/collection/${item.card.id}`} className="w-9 shrink-0" aria-label={item.card.name}>
                    <PokeCard card={item.card} sizes="36px" holo={false} />
                  </Link>
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-violet-300">{Icon ? <Icon className="size-4" /> : null}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-snug">
                    {item.user?.isPublic ? (
                      <Link href={`/u/${item.user.username}`} className="font-semibold hover:underline">
                        {item.user.username}
                      </Link>
                    ) : (
                      <span className="font-semibold">{item.user?.username ?? "A collector"}</span>
                    )}{" "}
                    <span className="text-muted-foreground">{item.message}</span>
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {item.rarity && <RarityBadge rarity={item.rarity as RarityKey} short />}
                    {item.value ? item.type === "LEVEL_UP" ? null : <RC amount={item.value} compact className="text-amber-200" /> : null}
                    <span>{timeAgo(item.createdAt)}</span>
                  </div>
                </div>
                {item.user && <UserAvatar avatar={item.user.avatar} image={item.user.image} username={item.user.username} className="size-7 opacity-80" />}
              </motion.li>
            );
          })}
        </AnimatePresence>
        {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No activity yet — be the first to pull a chase card!</li>}
      </ul>
    </div>
  );
}
