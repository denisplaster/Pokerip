import { AdminOverview } from "@/components/admin/admin-overview";
import { AdminHeader } from "@/components/admin/admin-ui";
import { getAdminStats } from "@/server/services/admin";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Overview" };

export default async function AdminPage() {
  await requireAdminPage();
  const stats = await getAdminStats(30);
  return (
    <>
      <AdminHeader title="Overview" description="Platform health, virtual currency issuance and pack-opening analytics." />
      <AdminOverview initial={stats} />
    </>
  );
}
