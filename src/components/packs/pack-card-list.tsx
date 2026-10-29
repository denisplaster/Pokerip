"use client";

import Link from "next/link";
import { useState } from "react";
import { RC } from "@/components/common/coin-icon";
import { PokeCard } from "@/components/cards/poke-card";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { Input } from "@/components/ui/input";
import { formatProbability } from "@/lib/format";
import { RARITIES, RARITY_META, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { CardView } from "@/server/services/cards";

/** Every card in a pack's pool with its exact per-slot probability. */
export function PackCardList({ cards }: { cards: { card: CardView; slotProbability: number }[] }) {
  const [rarity, setRarity] = useState<RarityKey | "ALL">("ALL");
  const [q, setQ] = useState("");
  const available = RARITIES.filter((r) => cards.some((c) => c.card.rarity === r));
  const needle = q.toLowerCase();
  const filtered = cards.filter(
    (c) => (rarity === "ALL" || c.card.rarity === rarity) && (!needle || `${c.card.name} ${c.card.set.name}`.toLowerCase().includes(needle)),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by rarity">
          {(["ALL", ...[...available].reverse()] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRarity(r)}
              aria-pressed={rarity === r}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                rarity === r ? "border-violet-400/50 bg-violet-500/15 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === "ALL" ? `All (${cards.length})` : `${RARITY_META[r].label} (${cards.filter((c) => c.card.rarity === r).length})`}
            </button>
          ))}
        </div>
        <Input placeholder="Search this pack…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-56" aria-label="Search cards in pack" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {filtered.map(({ card, slotProbability }) => (
          <Link key={card.id} href={`/collection/${card.id}`} className="group space-y-2">
            <div className="transition-transform group-hover:-translate-y-1">
              <PokeCard card={card} sizes="160px" />
            </div>
            <div className="space-y-1 px-0.5 text-xs">
              <p className="truncate text-sm font-semibold">{card.name}</p>
              <div className="flex items-center justify-between gap-1">
                <RarityBadge rarity={card.rarity} short />
                <span className="font-semibold tabular text-cyan-200" title="Chance per card slot">
                  {formatProbability(slotProbability)}
                </span>
              </div>
              <RC amount={card.currentValue} compact className="text-amber-200" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
