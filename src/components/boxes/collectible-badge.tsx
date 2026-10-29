import { Award, BadgeCheck, Crown, Medal, Pin, Trophy, type LucideIcon } from "lucide-react";
import { RARITY_META, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = { crown: Crown, trophy: Trophy, medal: Medal, badge: BadgeCheck, pin: Pin };

/** Limited-edition digital collectible medallion. */
export function CollectibleBadge({ icon, rarity, serial, maxSupply, className }: { icon: string; rarity: RarityKey; serial?: number; maxSupply?: number | null; className?: string }) {
  const Icon = ICONS[icon] ?? Award;
  const color = RARITY_META[rarity].color;
  return (
    <div className={cn("@container relative aspect-square w-full", className)}>
      <div
        className="absolute inset-0 rounded-full p-[6%] shadow-2xl"
        style={{ background: `conic-gradient(from 200deg, ${color}, #fde68a, ${color}, #a78bfa, ${color})` }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#2a2440,#0f0d18)] ring-1 ring-white/20">
          <Icon className="size-[42cqw]" style={{ color, filter: `drop-shadow(0 0 4cqw ${color})` }} strokeWidth={1.5} />
          {serial !== undefined && (
            <span className="mt-[3cqw] rounded-full bg-black/50 px-[5cqw] py-[1cqw] font-mono text-[8cqw] font-bold text-white/90">
              #{serial}
              {maxSupply ? `/${maxSupply}` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
