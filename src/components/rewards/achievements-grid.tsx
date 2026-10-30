import { Lock } from "lucide-react";
import { DynamicIcon } from "@/components/cards/dynamic-icon";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AchievementView } from "@/server/services/missions";

export const TIER_STYLE: Record<string, { ring: string; text: string; bg: string; label: string }> = {
  BRONZE: { ring: "ring-orange-400/40", text: "text-orange-300", bg: "from-orange-500/20", label: "Bronze" },
  SILVER: { ring: "ring-slate-300/40", text: "text-slate-200", bg: "from-slate-300/20", label: "Silver" },
  GOLD: { ring: "ring-amber-300/50", text: "text-amber-300", bg: "from-amber-400/25", label: "Gold" },
  PLATINUM: { ring: "ring-cyan-300/50", text: "text-cyan-200", bg: "from-cyan-300/25", label: "Platinum" },
};

export function AchievementBadge({ icon, tier, locked, className }: { icon: string; tier: string; locked?: boolean; className?: string }) {
  const t = TIER_STYLE[tier] ?? TIER_STYLE.BRONZE;
  return (
    <span
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br to-transparent ring-1",
        locked ? "from-white/5 text-muted-foreground ring-white/10" : `${t.bg} ${t.text} ${t.ring}`,
        className,
      )}
    >
      <DynamicIcon name={icon} className="size-6" />
      {locked && <Lock className="absolute -bottom-1 -right-1 size-4 rounded-full bg-background p-0.5 text-muted-foreground" />}
    </span>
  );
}

export function AchievementsGrid({ achievements }: { achievements: AchievementView[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {achievements.map((a) => {
        const unlocked = Boolean(a.unlockedAt);
        return (
          <li key={a.id} className={cn("surface flex gap-3 rounded-2xl border bg-card p-4", !unlocked && "opacity-80")}>
            <AchievementBadge icon={a.icon} tier={a.tier} locked={!unlocked} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold">{a.name}</p>
                <span className={cn("text-[10px] font-bold uppercase tracking-wide", TIER_STYLE[a.tier]?.text)}>{TIER_STYLE[a.tier]?.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{a.description}</p>
              {unlocked ? (
                <p className="text-[11px] text-emerald-300">Unlocked {formatDate(a.unlockedAt!)}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <Progress value={(a.current / a.threshold) * 100} className="h-1.5 flex-1" />
                  <span className="text-[10px] tabular text-muted-foreground">
                    {a.current.toLocaleString()}/{a.threshold.toLocaleString()}
                  </span>
                </div>
              )}
              {(a.rewardCoins > 0 || a.rewardXp > 0) && (
                <p className="text-[11px] text-muted-foreground">
                  Reward: {a.rewardCoins > 0 ? `${a.rewardCoins.toLocaleString()} RC` : ""}
                  {a.rewardCoins > 0 && a.rewardXp > 0 ? " · " : ""}
                  {a.rewardXp > 0 ? `${a.rewardXp} XP` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
