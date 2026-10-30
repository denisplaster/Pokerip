import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-ui";
import { PackEditor } from "@/components/admin/pack-editor";
import { Button } from "@/components/ui/button";
import { orNotFound } from "@/server/page-helpers";
import { getPackAdmin } from "@/server/services/admin";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Edit pack" };

export default async function AdminPackPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const pack = await orNotFound(getPackAdmin(id));
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/admin/packs"><ArrowLeft /> All packs</Link>
      </Button>
      <AdminHeader
        title={pack.name}
        description={`${pack._count.openings.toLocaleString()} openings · ${pack.pool.length} cards in pool · ${pack.isActive ? "active" : "inactive"}`}
        actions={<Button variant="outline" asChild><Link href={`/packs/${pack.slug}`}>View public page</Link></Button>}
      />
      <PackEditor key={pack.oddsVersions[0]?.id ?? "new"} pack={JSON.parse(JSON.stringify(pack))} />
    </>
  );
}
