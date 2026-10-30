"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, Target } from "lucide-react";
import { toast } from "sonner";
import { RC } from "@/components/common/coin-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useShowNotices } from "@/hooks/use-notices";
import { useSetBalance } from "@/hooks/use-wallet";
import { api } from "@/lib/api-client";
import type { ProgressNotice } from "@/lib/notices";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import type { MissionView } from "@/server/services/missions";
import { Countdown } from "./countdown";

const GROUPS = [
  { period: "DAILY", title: "Daily missions" },
  { period: "WEEKLY", title: "Weekly missions" },
  { period: "ONCE", title: "Milestones" },
] as const;

export function MissionsList({ initial }: { initial: MissionView[] }) {
  const qc = useQueryClient();
  const setBalance = useSetBalance();
  const showNotices = useShowNotices();
  const { data } = useQuery({
    queryKey: ["missions"],
    queryFn: () => api<{ missions: MissionView[] }>("/api/missions"),
    initialData: { missions: initial },
  });
  const claim = useMutation({
    mutationFn: (id: string) => api<{ coins: number; xp: number; balance: number; notices: ProgressNotice[] }>(`/api/missions/${id}/claim`, { method: "POST", body: {} }),
    onSuccess: (res) => {
      setBalance(res.balance);
      playSound("coin");
      toast.success(`Mission reward: +${res.coins.toLocaleString()} RC, +${res.xp} XP`);
      showNotices(res.notices);
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {GROUPS.map((g) => {
        const missions = data.missions.filter((m) => m.period === g.period);
        if (!missions.length) return null;
        return (
          <section key={g.period} className="surface rounded-2xl border bg-card p-5" aria-label={g.title}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="font-display font-semibold">{g.title}</h3>
              {missions[0].resetsAt && (
                <span className="text-xs text-muted-foreground">
                  <Countdown to={missions[0].resetsAt} />
                </span>
              )}
            </div>
            <ul className="space-y-4">
              {missions.map((m) => {
                const pct = (m.progress / m.target) * 100;
                return (
                  <li key={m.id} className={cn("space-y-2", m.claimed && "opacity-60")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-2.5">
                        <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", m.completed ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.05] text-muted-foreground")}>
                          {m.completed ? <Check className="size-4" /> : <Target className="size-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{m.description}</p>
                        </div>
                      </div>
                      {m.claimed ? (
                        <Badge variant="success">Claimed</Badge>
                      ) : m.completed ? (
                        <Button size="sm" variant="gold" disabled={claim.isPending} onClick={() => claim.mutate(m.id)}>
                          {claim.isPending && claim.variables === m.id ? <LoaderCircle className="animate-spin" /> : null} Claim
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={pct} className="h-1.5 flex-1" />
                      <span className="w-20 text-right text-[11px] tabular text-muted-foreground">
                        {m.progress.toLocaleString()}/{m.target.toLocaleString()}
                      </span>
                    </div>
                    <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      Reward <RC amount={m.rewardCoins} className="text-amber-200" /> · {m.rewardXp} XP
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
