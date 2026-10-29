import { AdminHeader } from "@/components/admin/admin-ui";
import { PackSimulator } from "@/components/admin/pack-simulator";
import { prisma } from "@/server/db";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Pack simulator" };

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  await requireAdminPage();
  const [{ pack }, packs] = await Promise.all([searchParams, prisma.pack.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } })]);
  return (
    <>
      <AdminHeader title="Pack simulator" description="Run 1,000 to 100,000 simulated openings against a pack's published odds and compare the outcome with the expected distribution." />
      <PackSimulator packs={packs} initialPack={packs.some((p) => p.id === pack) ? pack : undefined} />
    </>
  );
}
