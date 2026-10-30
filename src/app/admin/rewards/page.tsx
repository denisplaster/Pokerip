import { AdminRewards } from "@/components/admin/admin-rewards";
import { AdminHeader } from "@/components/admin/admin-ui";
import { prisma } from "@/server/db";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Rewards" };

export default async function AdminRewardsPage() {
  await requireAdminPage();
  const [days, missions, packs] = await Promise.all([
    prisma.dailyReward.findMany({ orderBy: { day: "asc" }, select: { day: true, coins: true, xp: true, packId: true, label: true } }),
    prisma.mission.findMany({ orderBy: [{ period: "asc" }, { sortOrder: "asc" }] }),
    prisma.pack.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <AdminHeader title="Daily rewards & missions" description="Tune the free-to-play earning loop." />
      <AdminRewards days={days} missions={JSON.parse(JSON.stringify(missions))} packs={packs} />
    </>
  );
}
