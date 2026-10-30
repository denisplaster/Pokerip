import { AdminCards } from "@/components/admin/admin-cards";
import { AdminHeader } from "@/components/admin/admin-ui";
import { prisma } from "@/server/db";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Cards" };

export default async function AdminCardsPage() {
  await requireAdminPage();
  const sets = await prisma.cardSet.findMany({ orderBy: [{ releaseYear: "asc" }, { name: "asc" }], select: { id: true, code: true, name: true } });
  return (
    <>
      <AdminHeader title="Cards & prices" description="Manage the card catalog and fictional virtual values. Cards owned by collectors are retired instead of deleted." />
      <AdminCards sets={sets} />
    </>
  );
}
