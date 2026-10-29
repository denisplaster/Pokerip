import { AdminPacksList } from "@/components/admin/admin-packs-list";
import { AdminHeader } from "@/components/admin/admin-ui";
import { listPacksAdmin } from "@/server/services/admin";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Packs" };

export default async function AdminPacksPage() {
  await requireAdminPage();
  const packs = await listPacksAdmin();
  return (
    <>
      <AdminHeader title="Packs & odds" description="Create packs, configure rarity probabilities and drop pools. Every odds change publishes a new immutable, hashed version." />
      <AdminPacksList packs={JSON.parse(JSON.stringify(packs))} />
    </>
  );
}
