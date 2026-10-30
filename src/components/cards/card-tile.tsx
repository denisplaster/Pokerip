import { Heart } from "lucide-react";
import { RC } from "@/components/common/coin-icon";
import { cn } from "@/lib/utils";
import { PokeCard, type CardFaceData } from "./poke-card";
import { RarityBadge } from "./rarity-badge";

export interface CardTileData extends CardFaceData {
  id: string;
  currentValue: number;
}

/** Card thumbnail with name, set, rarity and virtual value. */
export function CardTile({
  card,
  quantity,
  listed,
  favorite,
  badge,
  className,
  compact,
}: {
  card: CardTileData;
  quantity?: number;
  listed?: number;
  favorite?: boolean;
  badge?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("group relative flex flex-col gap-2", className)}>
      <div className="relative transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[0.6deg]">
        <PokeCard card={card} />
        {quantity !== undefined && quantity > 1 && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white shadow-lg ring-2 ring-background tabular">
            ×{quantity}
          </span>
        )}
        {favorite && (
          <span role="img" className="absolute left-1.5 top-1.5 rounded-full bg-black/60 p-1 backdrop-blur" aria-label="Favourite">
            <Heart className="size-3 fill-rose-400 text-rose-400" />
          </span>
        )}
        {badge}
      </div>
      {!compact && (
        <div className="min-w-0 space-y-1 px-0.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{card.name}</p>
            <RarityBadge rarity={card.rarity} short className="shrink-0" />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {card.variant ? `${card.variant} · ` : ""}
            {card.set.name} {card.number}
          </p>
          <div className="flex items-center justify-between text-xs">
            <RC amount={card.currentValue} className="text-amber-200" compact />
            {listed ? <span className="text-cyan-300">{listed} listed</span> : null}
          </div>
        </div>
      )}
    </div>
  );
}
