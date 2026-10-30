import Image from "next/image";
import { RARITY_META, rarityRank, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import { energyMeta } from "./energy";
import { RarityGem } from "./rarity-badge";

export interface CardFaceData {
  name: string;
  number: string;
  variant: string | null;
  rarity: RarityKey;
  energyType: string;
  dexNumber: number | null;
  imageUrl: string | null;
  grade: string | null;
  releaseYear?: number;
  set: { name: string };
}

const FRAME: Record<RarityKey, string> = {
  COMMON: "linear-gradient(160deg, #52525b, #27272a 60%, #3f3f46)",
  UNCOMMON: "linear-gradient(160deg, #7dd3fc, #1e3a8a 55%, #38bdf8)",
  RARE: "linear-gradient(160deg, #c4b5fd, #4c1d95 55%, #a78bfa)",
  ULTRA_RARE: "linear-gradient(150deg, #fef3c7, #f59e0b 30%, #92400e 60%, #fde68a)",
  SECRET_RARE: "conic-gradient(from 210deg, #f472b6, #a78bfa, #22d3ee, #34d399, #facc15, #fb923c, #f472b6)",
  CHASE: "linear-gradient(140deg, #fecdd3, #fb7185 25%, #f59e0b 50%, #a78bfa 75%, #fde68a)",
};

/**
 * Renders a collectible card. Without an imported image it draws RipVault's
 * own placeholder art (type-coloured burst, energy glyph, dex number) — no
 * official artwork is used.
 */
export function PokeCard({
  card,
  className,
  holo,
  sizes = "(max-width: 768px) 45vw, 240px",
  priority,
}: {
  card: CardFaceData;
  className?: string;
  /** Force the holographic overlay on/off. Defaults to on for Rare and above. */
  holo?: boolean;
  sizes?: string;
  priority?: boolean;
}) {
  const showHolo = holo ?? rarityRank(card.rarity) >= rarityRank("RARE");
  const inner = card.imageUrl ? (
    <div className="relative h-full w-full overflow-hidden rounded-[4.5%] bg-black/40">
      <Image src={card.imageUrl} alt={`${card.name} ${card.number}`} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  ) : (
    <PlaceholderFace card={card} />
  );

  return (
    <div className={cn("@container relative aspect-[63/88] w-full select-none", className)} role="img" aria-label={`${card.name}, ${card.set.name} ${card.number}, ${RARITY_META[card.rarity].label}`}>
      {card.grade ? <Slab card={card}>{inner}</Slab> : inner}
      {showHolo && <div className="holo-layer rounded-[5%]" aria-hidden />}
    </div>
  );
}

function PlaceholderFace({ card }: { card: CardFaceData }) {
  const energy = energyMeta(card.energyType);
  const Icon = energy.icon;
  const rank = rarityRank(card.rarity);
  return (
    <div className="absolute inset-0 rounded-[5%] p-[3.4%] shadow-[0_10px_30px_-12px_rgba(0,0,0,.8)]" style={{ background: FRAME[card.rarity] }}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[3.6%] bg-[#111019]">
        <div className="flex items-start justify-between gap-[2cqw] px-[5cqw] pt-[4cqw]">
          <div className="min-w-0">
            <p className="truncate font-display text-[7.6cqw] font-bold leading-tight text-white">{card.name}</p>
            <p className="truncate text-[4.4cqw] leading-snug text-white/55">{card.variant ?? energy.label}</p>
          </div>
          <RarityGem rarity={card.rarity} className="mt-[1.5cqw] size-[6.5cqw] shrink-0" />
        </div>
        <div className="relative mx-[5cqw] mt-[3cqw] flex flex-1 items-center justify-center overflow-hidden rounded-[2.4cqw] ring-1 ring-white/15">
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 42%, ${energy.from} 0%, ${energy.to} 70%, ${energy.ink} 120%)` }} />
          <div
            className="absolute inset-0 opacity-25 mix-blend-overlay"
            style={{ background: "repeating-conic-gradient(from 0deg at 50% 42%, rgba(255,255,255,.55) 0 5deg, transparent 5deg 15deg)" }}
          />
          <div className="absolute aspect-square w-[78%] rounded-full border border-white/25" />
          <div className="absolute aspect-square w-[56%] rounded-full border border-white/20 bg-white/[0.06]" />
          {rank >= rarityRank("SECRET_RARE") && (
            <div className="absolute inset-0 opacity-60 mix-blend-color-dodge" style={{ background: "linear-gradient(120deg, transparent 25%, rgba(255,255,255,.35) 45%, transparent 60%)" }} />
          )}
          <Icon className="relative size-[34cqw] text-white" strokeWidth={1.6} style={{ filter: `drop-shadow(0 0 3cqw ${energy.from})` }} />
          {card.dexNumber && (
            <span className="absolute bottom-[1cqw] right-[2.5cqw] font-display text-[11cqw] font-black text-white/25 tabular">
              #{String(card.dexNumber).padStart(3, "0")}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-[2cqw] px-[5cqw] pb-[3.6cqw] pt-[2.6cqw] text-[3.9cqw] text-white/55">
          <span className="truncate">{card.set.name}</span>
          <span className="shrink-0 tabular">{card.number}</span>
        </div>
      </div>
    </div>
  );
}

/** Acrylic case + label for graded vault cards. */
function Slab({ card, children }: { card: CardFaceData; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col rounded-[5%] bg-gradient-to-b from-white/25 via-white/10 to-white/20 p-[3cqw] ring-1 ring-white/30">
      <div className="mb-[2.5cqw] flex items-center justify-between gap-[2cqw] rounded-[2cqw] bg-gradient-to-r from-zinc-100 to-zinc-300 px-[3cqw] py-[2cqw] text-zinc-900">
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[4.4cqw] font-bold uppercase">{card.name}</p>
          <p className="truncate text-[3.4cqw] text-zinc-600">
            {card.releaseYear ? `${card.releaseYear} · ` : ""}
            {card.number}
          </p>
        </div>
        <span className="shrink-0 rounded-[1.5cqw] bg-zinc-900 px-[2cqw] py-[1cqw] font-display text-[5.4cqw] font-black text-amber-300">{card.grade}</span>
      </div>
      <div className="relative mx-auto aspect-[63/88] w-[84%]">{children}</div>
    </div>
  );
}
