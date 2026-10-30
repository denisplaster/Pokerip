import { RarityBadge } from "@/components/cards/rarity-badge";
import { formatOneIn, formatPpm, formatProbability } from "@/lib/format";
import { atLeastOnceInPack } from "@/lib/probability";
import type { RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";

/** Published per-slot rarity odds plus the chance of at least one hit per pack. */
export function OddsTable({ odds, cardsPerPack, className, compact }: { odds: { rarity: RarityKey; weightPpm: number; cards: number }[]; cardsPerPack: number; className?: string; compact?: boolean }) {
  const rows = odds.filter((o) => o.weightPpm > 0);
  return (
    <div className={cn("overflow-hidden rounded-xl border", className)}>
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Rarity</th>
            <th className="px-3 py-2 text-right font-medium">Per card</th>
            {!compact && <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Odds</th>}
            <th className="px-3 py-2 text-right font-medium">≥1 per pack</th>
            {!compact && <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Cards</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const p = o.weightPpm / 1_000_000;
            return (
              <tr key={o.rarity} className="border-t">
                <td className="px-3 py-2">
                  <RarityBadge rarity={o.rarity} />
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular">{formatPpm(o.weightPpm)}</td>
                {!compact && <td className="hidden px-3 py-2 text-right text-muted-foreground tabular sm:table-cell">{formatOneIn(p)}</td>}
                <td className="px-3 py-2 text-right tabular">{formatProbability(atLeastOnceInPack(p, cardsPerPack))}</td>
                {!compact && <td className="hidden px-3 py-2 text-right text-muted-foreground tabular md:table-cell">{o.cards}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
