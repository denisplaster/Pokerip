"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronsUp, Coins, Crown, Gem, Layers, LoaderCircle, Medal, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RC } from "@/components/common/coin-icon";
import { UserAvatar } from "@/components/common/user-avatar";
import { PokeCard } from "@/components/cards/poke-card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { LeaderboardData, LeaderboardEntry } from "@/server/services/leaderboards";

const CATEGORIES = [
  { key: "collection_value", label: "Collection value", icon: Coins, snapshot: true },
  { key: "biggest_pull", label: "Biggest pull", icon: Zap, snapshot: false },
  { key: "cards_collected", label: "Cards collected", icon: Layers, snapshot: false },
  { key: "unique_cards", label: "Unique cards", icon: Gem, snapshot: true },
  { key: "level", label: "Highest level", icon: ChevronsUp, snapshot: true },
  { key: "sets_completed", label: "Sets completed", icon: BookOpen, snapshot: true },
] as const;

const PERIODS = [
  { key: "day", label: "24 hours" },
  { key: "week", label: "7 days" },
  { key: "month", label: "30 days" },
  { key: "all", label: "All time" },
] as const;

type Category = (typeof CATEGORIES)[number]["key"];
type Period = (typeof PERIODS)[number]["key"];

function Score({ category, entry }: { category: Category; entry: LeaderboardEntry }) {
  if (category === "collection_value" || category === "biggest_pull") return <RC amount={entry.score} compact className="text-amber-100" />;
  if (category === "level") return <span className="font-semibold tabular">Lv {entry.score}</span>;
  return <span className="font-semibold tabular">{entry.score.toLocaleString()}</span>;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const color = rank === 1 ? "text-amber-300 bg-amber-400/15" : rank === 2 ? "text-slate-200 bg-slate-300/15" : "text-orange-300 bg-orange-400/15";
    return (
      <span role="img" className={cn("flex size-8 items-center justify-center rounded-lg", color)} aria-label={`Rank ${rank}`}>
        {rank === 1 ? <Crown className="size-4" /> : <Medal className="size-4" />}
      </span>
    );
  }
  return <span className="flex size-8 items-center justify-center text-sm font-semibold tabular text-muted-foreground">{rank}</span>;
}

function Row({ entry, category }: { entry: LeaderboardEntry; category: Category }) {
  const name = (
    <span className="flex min-w-0 items-center gap-2">
      <UserAvatar avatar={entry.user.avatar} image={entry.user.image} username={entry.user.username} className="size-8" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{entry.user.username}</span>
          {entry.isViewer && <Badge variant="default">You</Badge>}
          {entry.user.isBot && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span><Badge variant="outline" className="text-[10px]">Demo</Badge></span>
              </TooltipTrigger>
              <TooltipContent>Seeded demo collector</TooltipContent>
            </Tooltip>
          )}
        </span>
        <span className="block text-[11px] text-muted-foreground">Level {entry.user.level}</span>
      </span>
    </span>
  );
  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", entry.isViewer && "bg-violet-500/[0.08]")}>
      <RankBadge rank={entry.rank} />
      <div className="min-w-0 flex-1">{entry.user.isPublic && entry.user.id ? <Link href={`/u/${entry.user.username}`} className="hover:underline">{name}</Link> : name}</div>
      {category === "biggest_pull" && entry.card && (
        <Link href={`/collection/${entry.card.id}`} className="hidden items-center gap-2 sm:flex">
          <span className="w-8"><PokeCard card={entry.card} sizes="32px" holo={false} /></span>
          <span className="max-w-40 truncate text-xs text-muted-foreground">{entry.card.name}</span>
        </Link>
      )}
      <div className="w-28 text-right">
        <Score category={category} entry={entry} />
      </div>
    </li>
  );
}

export function LeaderboardView({ initial }: { initial: LeaderboardData }) {
  const [category, setCategory] = useState<Category>(initial.category as Category);
  const [period, setPeriod] = useState<Period>(initial.period as Period);
  const meta = CATEGORIES.find((c) => c.key === category)!;
  const effectivePeriod = meta.snapshot ? "all" : period;
  const isInitial = category === initial.category && effectivePeriod === initial.period;
  const { data, isFetching } = useQuery({
    queryKey: ["leaderboard", category, effectivePeriod],
    queryFn: () => api<LeaderboardData>(`/api/leaderboards?category=${category}&period=${effectivePeriod}`),
    placeholderData: keepPreviousData,
    initialData: isInitial ? initial : undefined,
    refetchInterval: 30_000,
  });
  const viewerOutside = data?.viewer && !data.entries.some((e) => e.isViewer);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Leaderboard category">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              role="tab"
              aria-selected={category === c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                category === c.key ? "border-violet-400/50 bg-violet-500/15 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {c.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-xl border p-1" role="group" aria-label="Time period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              disabled={meta.snapshot && p.key !== "all"}
              aria-pressed={effectivePeriod === p.key}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                effectivePeriod === p.key ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {meta.snapshot ? "Current standings — this ranking is a live snapshot." : "Ranked by activity within the selected period."}
        </p>
      </div>
      <div className={cn("surface overflow-hidden rounded-2xl border bg-card transition-opacity", isFetching && "opacity-70")}>
        {!data ? (
          <div className="flex h-60 items-center justify-center"><LoaderCircle className="animate-spin text-muted-foreground" /></div>
        ) : data.entries.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-muted-foreground">No collectors ranked for this period yet.</p>
        ) : (
          <ol className="divide-y">
            {data.entries.map((e) => (
              <Row key={`${e.rank}-${e.user.username}-${e.isViewer}`} entry={e} category={category} />
            ))}
          </ol>
        )}
        {viewerOutside && data?.viewer && (
          <div className="border-t-2 border-dashed">
            <ol>
              <Row entry={data.viewer} category={category} />
            </ol>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Private profiles appear as “Anonymous collector”. All values are fictional Rip Coin amounts.</p>
    </div>
  );
}
