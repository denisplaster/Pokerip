"use client";

import { motion } from "framer-motion";
import { Coins, Library, PackageOpen, Repeat, Sparkles } from "lucide-react";
import Link from "next/link";
import { RC } from "@/components/common/coin-icon";
import { PokeCard } from "@/components/cards/poke-card";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { TiltCard } from "@/components/cards/tilt-card";
import { Button } from "@/components/ui/button";
import { RARITIES, RARITY_META, rarityRank } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { OpenResult, PulledCard } from "@/server/services/packs";

export function RipSummary({
  result,
  sold,
  quickSellable,
  quickSellTotal,
  onQuickSell,
  selling,
  onOpenAgain,
  opening,
  canAfford,
}: {
  result: OpenResult;
  sold: Set<string>;
  quickSellable: PulledCard[];
  quickSellTotal: number;
  onQuickSell: () => void;
  selling: boolean;
  onOpenAgain: (qty: 1 | 5 | 10) => void;
  opening: boolean;
  canAfford: (qty: number) => boolean;
}) {
  const all = result.packs.flatMap((p) => p.cards);
  const sorted = [...all].sort((a, b) => b.value - a.value || rarityRank(b.rarity) - rarityRank(a.rarity));
  const best = sorted[0];
  const newCount = all.filter((c) => c.isNew).length;
  const counts = RARITIES.map((r) => ({ r, n: all.filter((c) => c.rarity === r).length })).filter((x) => x.n > 0);

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8" aria-labelledby="rip-summary-title">
      <div className="grid gap-6 rounded-2xl border bg-card/80 p-5 sm:p-6 lg:grid-cols-[220px_1fr]">
        {best && (
          <div className="mx-auto w-44 sm:w-52">
            <TiltCard>
              <PokeCard card={best.card} sizes="220px" />
            </TiltCard>
            <p className="mt-2 text-center text-xs uppercase tracking-wide text-muted-foreground">Best pull</p>
          </div>
        )}
        <div className="flex flex-col justify-center gap-4">
          <div>
            <h2 id="rip-summary-title" className="font-display text-2xl font-bold sm:text-3xl">
              Rip complete{result.packs.length > 1 ? ` — ${result.packs.length} packs` : ""}
            </h2>
            <p className="text-sm text-muted-foreground">
              {all.length} cards added to your collection{newCount ? `, ${newCount} new` : ""}.
              {result.usedVoucher ? " Opened with a free voucher." : ""}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/[0.04] p-3">
              <dt className="text-xs text-muted-foreground">Pull value</dt>
              <dd className="mt-1 text-lg">
                <RC amount={result.totalValue} className="text-amber-200" />
              </dd>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-3">
              <dt className="text-xs text-muted-foreground">Spent</dt>
              <dd className="mt-1 text-lg">
                <RC amount={result.totalPaid} />
              </dd>
            </div>
            {best && (
              <div className="col-span-2 rounded-xl bg-white/[0.04] p-3 sm:col-span-1">
                <dt className="text-xs text-muted-foreground">Top hit</dt>
                <dd className="mt-1 truncate text-sm font-semibold">{best.card.name}</dd>
              </div>
            )}
          </dl>
          <div className="flex flex-wrap gap-1.5">
            {counts.map(({ r, n }) => (
              <span key={r} className="flex items-center gap-1 text-xs">
                <RarityBadge rarity={r} /> <span className="tabular text-muted-foreground">×{n}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {([1, 5, 10] as const).map((q) => (
              <Button key={q} onClick={() => onOpenAgain(q)} disabled={opening || !canAfford(q)} variant={q === 1 ? "default" : "outline"}>
                {q === 1 ? <Repeat /> : <PackageOpen />}
                {q === 1 ? "Open another" : `Open ${q}×`} · <RC amount={result.pack.price * q} />
              </Button>
            ))}
            <Button variant="ghost" asChild>
              <Link href="/collection">
                <Library /> Collection
              </Link>
            </Button>
          </div>
          {quickSellable.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                <Coins className="mr-1 inline size-4 text-amber-300" />
                {quickSellable.length} duplicate common/uncommon {quickSellable.length === 1 ? "card" : "cards"} from this rip.
              </p>
              <Button size="sm" variant="gold" onClick={onQuickSell} disabled={selling}>
                Quick-sell for <RC amount={quickSellTotal} />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className={cn(result.packs.length > 1 ? "grid gap-x-8 gap-y-6 lg:grid-cols-2" : "")}>
      {result.packs.map((p, i) => (
        <div key={p.openingId} className={cn("space-y-3", result.packs.length > 1 && "rounded-2xl border bg-white/[0.02] p-3")}>
          {result.packs.length > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold">Pack {i + 1}</p>
              <RC amount={p.totalValue} className="text-amber-200" />
            </div>
          )}
          <div className={cn("grid", result.packs.length > 1 ? "grid-cols-5 gap-2 sm:gap-3" : "grid-cols-3 gap-3 sm:gap-4 md:grid-cols-5")}>
            {[...p.cards]
              .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.value - a.value)
              .map((c) => {
                const isSold = c.userCardId ? sold.has(c.userCardId) : false;
                return (
                  <Link key={c.rewardId} href={`/collection/${c.card.id}`} className={cn("group space-y-1.5", isSold && "opacity-40")}>
                    <div className="relative transition-transform group-hover:-translate-y-1">
                      <PokeCard card={c.card} sizes="180px" />
                      {c.isNew && <span className="absolute -left-1 -top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-950">New</span>}
                      {isSold && <span className="absolute inset-0 flex items-center justify-center rounded-[5%] bg-black/50 text-xs font-bold uppercase">Sold</span>}
                    </div>
                    <p className={cn("truncate text-xs font-semibold", RARITY_META[c.rarity].text)}>{c.card.name}</p>
                    <RC amount={c.value} compact className="text-xs text-amber-200/90" />
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
      </div>
      {result.notices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.notices.map((n, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
              <Sparkles className="size-3.5" /> {n.title}
            </span>
          ))}
        </div>
      )}
    </motion.section>
  );
}
