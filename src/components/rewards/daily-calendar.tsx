"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Flame, Gift, LoaderCircle, PackageOpen } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { CoinIcon } from "@/components/common/coin-icon";
import { Button } from "@/components/ui/button";
import { useShowNotices } from "@/hooks/use-notices";
import { useSetBalance } from "@/hooks/use-wallet";
import { api } from "@/lib/api-client";
import { fireConfetti } from "@/lib/confetti";
import type { ProgressNotice } from "@/lib/notices";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Countdown } from "./countdown";

export interface DailyStatus {
  streak: number;
  claimedToday: boolean;
  nextDay: number;
  todayDay: number;
  resetsAt: string;
  rewards: { day: number; coins: number; xp: number; label: string; pack: { id: string; name: string; slug: string; theme: string } | null }[];
}

export function DailyCalendar({ initial }: { initial: DailyStatus }) {
  const qc = useQueryClient();
  const setBalance = useSetBalance();
  const showNotices = useShowNotices();
  const { data = initial } = useQuery({ queryKey: ["daily"], queryFn: () => api<DailyStatus>("/api/rewards/daily"), initialData: initial });
  const claim = useMutation({
    mutationFn: () => api<{ day: number; coins: number; xp: number; streak: number; pack: { name: string; slug: string } | null; balance: number; notices: ProgressNotice[] }>("/api/rewards/daily", { method: "POST", body: {} }),
    onSuccess: (res) => {
      setBalance(res.balance);
      playSound("coin");
      fireConfetti("gold", res.pack ? 1 : 0.6);
      toast.success(res.pack ? `Day ${res.day}: free ${res.pack.name}!` : `Day ${res.day}: +${res.coins.toLocaleString()} RC`, {
        description: `${res.streak}-day streak · +${res.xp} XP`,
      });
      showNotices(res.notices);
      for (const k of ["daily", "wallet", "missions", "achievements"]) qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const claimedThrough = data.claimedToday ? data.todayDay : data.todayDay - 1;
  return (
    <section className="surface rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="daily-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="daily-title" className="font-display text-xl font-bold">Daily login rewards</h2>
          <p className="text-sm text-muted-foreground">Claim once per UTC day. Miss a day and the streak restarts at day 1.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-3 py-1.5 font-semibold text-orange-200">
            <Flame className="size-4" /> {data.streak}-day streak
          </span>
          <span className="text-xs text-muted-foreground">
            <Countdown to={data.resetsAt} prefix="Next reward in" />
          </span>
        </div>
      </div>
      <ol className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7 sm:gap-3">
        {data.rewards.map((r) => {
          const claimed = r.day <= claimedThrough;
          const isToday = r.day === data.todayDay && !data.claimedToday;
          return (
            <motion.li
              key={r.day}
              whileHover={{ y: -3 }}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center",
                r.day === 7 && "col-span-2 sm:col-span-1",
                claimed && "border-emerald-400/30 bg-emerald-500/[0.07]",
                isToday && "border-amber-400/60 bg-amber-400/[0.08] shadow-[0_0_30px_-8px_#f59e0b]",
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Day {r.day}</span>
              <span className="flex size-10 items-center justify-center rounded-full bg-white/[0.05]">
                {claimed ? <Check className="size-5 text-emerald-300" /> : r.pack ? <Gift className="size-5 text-violet-300" /> : <CoinIcon className="size-6" />}
              </span>
              <span className="text-xs font-semibold leading-tight">{r.label}</span>
              {r.xp > 0 && <span className="text-[10px] text-muted-foreground">+{r.xp} XP</span>}
            </motion.li>
          );
        })}
      </ol>
      <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {data.claimedToday ? `Come back tomorrow for day ${data.nextDay}.` : `Today's reward: day ${data.todayDay}.`}
        </p>
        {data.claimedToday ? (
          data.rewards.find((r) => r.day === data.todayDay)?.pack ? (
            <Button asChild variant="outline">
              <Link href={`/open/${data.rewards.find((r) => r.day === data.todayDay)!.pack!.slug}`}>
                <PackageOpen /> Open your free pack
              </Link>
            </Button>
          ) : (
            <Button disabled variant="outline">
              <Check /> Claimed today
            </Button>
          )
        ) : (
          <Button variant="gold" size="lg" onClick={() => claim.mutate()} disabled={claim.isPending}>
            {claim.isPending ? <LoaderCircle className="animate-spin" /> : <Gift />} Claim day {data.todayDay}
          </Button>
        )}
      </div>
    </section>
  );
}
