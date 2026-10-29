import { AdminSettings } from "@/components/admin/admin-settings";
import { AdminHeader } from "@/components/admin/admin-ui";
import { listAuditLog } from "@/server/services/admin";
import { getLastTick } from "@/server/services/market";
import { getSettings, invalidateSettingsCache } from "@/server/services/settings";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Economy & audit" };

export default async function AdminSettingsPage() {
  await requireAdminPage();
  invalidateSettingsCache();
  const [settings, audit, lastTick] = await Promise.all([getSettings(), listAuditLog(100), getLastTick()]);
  return (
    <>
      <AdminHeader title="Economy & audit" description="Global economy parameters, the market simulation and the administrator audit log." />
      <AdminSettings initial={settings} audit={JSON.parse(JSON.stringify(audit))} lastTick={lastTick?.toISOString() ?? null} />
    </>
  );
}
