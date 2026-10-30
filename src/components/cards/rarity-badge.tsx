import { RARITY_META, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";

export function RarityBadge({ rarity, className, short }: { rarity: RarityKey; className?: string; short?: boolean }) {
  const meta = RARITY_META[rarity];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset", meta.chip, className)}>
      <RarityGem rarity={rarity} className="size-2.5" />
      {short ? meta.short : meta.label}
    </span>
  );
}

/** Small rarity symbol used on card faces and chips. */
export function RarityGem({ rarity, className }: { rarity: RarityKey; className?: string }) {
  const color = RARITY_META[rarity].color;
  if (rarity === "COMMON") return <svg viewBox="0 0 10 10" className={className} aria-hidden><circle cx="5" cy="5" r="4" fill={color} /></svg>;
  if (rarity === "UNCOMMON") return <svg viewBox="0 0 10 10" className={className} aria-hidden><path d="M5 .8 9.2 5 5 9.2.8 5Z" fill={color} /></svg>;
  if (rarity === "RARE")
    return (
      <svg viewBox="0 0 10 10" className={className} aria-hidden>
        <path d="m5 .5 1.4 2.9 3.1.4-2.3 2.2.6 3.1L5 7.6 2.2 9.1l.6-3.1L.5 3.8l3.1-.4Z" fill={color} />
      </svg>
    );
  return (
    <svg viewBox="0 0 10 10" className={className} aria-hidden>
      <defs>
        <linearGradient id={`gem-${rarity}`} x1="0" x2="1" y1="0" y2="1">
          {rarity === "SECRET_RARE" || rarity === "CHASE" ? (
            <>
              <stop offset="0" stopColor="#f472b6" />
              <stop offset=".5" stopColor="#22d3ee" />
              <stop offset="1" stopColor="#facc15" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#fde68a" />
              <stop offset="1" stopColor="#f59e0b" />
            </>
          )}
        </linearGradient>
      </defs>
      <path d="m5 .5 1.4 2.9 3.1.4-2.3 2.2.6 3.1L5 7.6 2.2 9.1l.6-3.1L.5 3.8l3.1-.4Z" fill={`url(#gem-${rarity})`} />
      {rarity === "CHASE" && <circle cx="5" cy="5" r="1.2" fill="#fff" />}
    </svg>
  );
}
