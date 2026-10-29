import type { Metadata } from "next";
import { LiveFeed } from "@/components/activity/live-feed";
import { Container, PageHeader } from "@/components/common/page-header";
import { LeaderboardView } from "@/components/leaderboards/leaderboard-view";
import { listActivity } from "@/server/services/activity";
import { getLeaderboard } from "@/server/services/leaderboards";
import { getSessionUser } from "@/server/session";

export const metadata: Metadata = { title: "Leaderboards" };
export const dynamic = "force-dynamic";

export default async function LeaderboardsPage() {
  const user = await getSessionUser();
  const [board, activity] = await Promise.all([getLeaderboard("collection_value", "all", user?.id), listActivity({ limit: 10 })]);
  return (
    <Container>
      <PageHeader eyebrow="Rankings" title="Leaderboards" description="See who's built the most valuable vault, landed the biggest pulls and completed the most sets." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <LeaderboardView initial={board} />
        <LiveFeed initial={activity} limit={10} className="h-fit" />
      </div>
    </Container>
  );
}
