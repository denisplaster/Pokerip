"use client";

import { motion } from "framer-motion";
import { Gift, Info, PackageOpen } from "lucide-react";
import Link from "next/link";
import { RC } from "@/components/common/coin-icon";
import { PokeCard } from "@/components/cards/poke-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPpm } from "@/lib/format";
import type { PackSummary } from "@/server/services/packs";
import { PackArt } from "./pack-art";
import { packTheme } from "./pack-themes";

export function PackShopCard({ pack, vouchers = 0 }: { pack: PackSummary; vouchers?: number }) {
  const theme = packTheme(pack.theme);
  const top = [...pack.odds].reverse().find((o) => o.weightPpm > 0);
  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group surface relative flex flex-col overflow-hidden rounded-2xl border bg-card"
    >
      <div className="absolute inset-x-0 top-0 h-48 opacity-40 blur-3xl transition-opacity group-hover:opacity-70" style={{ background: `radial-gradient(circle at 50% 0%, ${theme.glow}, transparent 70%)` }} />
      <Link href={`/packs/${pack.slug}`} className="relative flex items-end justify-center gap-2 px-6 pt-6" aria-label={`${pack.name} details`}>
        <div className="w-[46%] transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-[1.03]">
          <PackArt theme={pack.theme} name={pack.name} cards={pack.cardsPerPack} />
        </div>
        <div className="flex w-[34%] flex-col gap-2 pb-2">
          {pack.chaseCards.slice(0, 2).map((c, i) => (
            <div key={c.id} className="transition-transform duration-500" style={{ transform: `rotate(${i ? 6 : -4}deg)` }}>
              <PokeCard card={c} sizes="120px" />
            </div>
          ))}
        </div>
        {pack.featured && <Badge variant="gold" className="absolute left-4 top-4">Featured</Badge>}
        {vouchers > 0 && (
          <Badge variant="success" className="absolute right-4 top-4">
            <Gift /> {vouchers} free
          </Badge>
        )}
      </Link>
      <div className="relative flex flex-1 flex-col gap-3 p-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">{pack.name}</h2>
            <RC amount={pack.price} className="text-lg text-amber-200" />
          </div>
          <p className="text-sm text-muted-foreground">{pack.tagline}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-white/[0.04] p-2">
            <dt className="text-muted-foreground">Cards</dt>
            <dd className="font-semibold tabular">{pack.cardsPerPack}</dd>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-2">
            <dt className="text-muted-foreground">Pool</dt>
            <dd className="font-semibold tabular">{pack.poolSize}</dd>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-2">
            <dt className="text-muted-foreground">{top ? (top.rarity === "CHASE" ? "Chase" : "Top tier") : "—"}</dt>
            <dd className="font-semibold tabular">{top ? formatPpm(top.weightPpm) : "—"}</dd>
          </div>
        </dl>
        <div className="mt-auto flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/packs/${pack.slug}`}>
              <Info /> Odds
            </Link>
          </Button>
          <Button asChild className="flex-[1.4]">
            <Link href={`/open/${pack.slug}`}>
              <PackageOpen /> Open
            </Link>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
