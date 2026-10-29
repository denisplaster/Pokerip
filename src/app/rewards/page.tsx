import { ChevronsUp, Coins, Info } from "lucide-react";
import type { Metadata } from "next";
import { Container, PageHeader, SectionHeading } from "@/components/common/page-header";
import { AchievementsGrid } from "@/components/rewards/achievements-grid";
import { DailyCalendar } from "@/components/rewards/daily-calendar";
import { MissionsList } from "@/components/rewards/missions-list";
import { Progress } from "@/components/ui/progress";
import { levelProgress, levelUpReward } from "@/lib/levels";
import { prisma } from "@/server/db";
import { getDailyStatus } from "@/server/services/daily";
import { getAchievements, getMissions } from "@/server/services/missions";
import { getSettings } from "@/server/services/settings";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Daily Rewards" };
export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const user = await requireUser("/rewards");
  const [daily, missions, achievements, full, { economy }] = await Promise.all([
    getDailyStatus(user.id),
    getMissions(user.id),
    getAchievements(user.id),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { xp: true } }),
    getSettings(),
  ]);
  const progress = levelProgress(full.xp);
  const unlocked = achievements.filter((a) => a.unlockedAt).length;
  return (
    <Container>
      <PageHeader
        eyebrow="Free to play"
        title="Rewards & progression"
        description="Earn Rip Coins every day without spending anything: daily logins, missions, achievements, collection milestones and level-ups."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <DailyCalendar initial={daily} />
        <section className="surface flex flex-col justify-between gap-4 rounded-2xl border bg-card p-5" aria-label="Level">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ChevronsUp className="size-4" /> Collector level
            </p>
            <p className="mt-2 font-display text-5xl font-bold">{progress.level}</p>
            <Progress value={progress.progress * 100} className="mt-3" />
            <p className="mt-1.5 text-xs text-muted-foreground tabular">
              {progress.isMax ? "Max level reached" : `${progress.xpIntoLevel.toLocaleString()} / ${progress.xpForNext.toLocaleString()} XP to level ${progress.level + 1}`}
            </p>
          </div>
          {!progress.isMax && (
            <p className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-3 text-xs text-muted-foreground">
              <Coins className="size-4 text-amber-300" /> Next level-up pays {levelUpReward(progress.level + 1, economy.levelUpBaseReward, economy.levelUpPerLevel).toLocaleString()} RC.
            </p>
          )}
          <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" /> Earn XP by opening packs and boxes, claiming daily rewards, completing missions and unlocking achievements.
          </p>
        </section>
      </div>
      <section className="mt-10">
        <SectionHeading title="Missions" description="Complete missions, then claim their rewards here." />
        <MissionsList initial={missions} />
      </section>
      <section className="mt-10">
        <SectionHeading title="Achievements & badges" description={`${unlocked} of ${achievements.length} unlocked. Badges show on your public profile.`} />
        <AchievementsGrid achievements={achievements} />
      </section>
    </Container>
  );
}
