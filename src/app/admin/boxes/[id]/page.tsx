import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-ui";
import { BoxEditor, type BoxForm } from "@/components/admin/box-editor";
import { Button } from "@/components/ui/button";
import { prisma } from "@/server/db";
import { orNotFound } from "@/server/page-helpers";
import { getBoxAdmin } from "@/server/services/admin";
import { toCardView } from "@/server/services/cards";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Edit mystery box" };

export default async function AdminBoxPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const isNew = id === "new";
  const [box, packs, collectibles] = await Promise.all([
    isNew ? null : orNotFound(getBoxAdmin(id)),
    prisma.pack.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.collectible.findMany({ orderBy: { value: "asc" }, select: { id: true, name: true, maxSupply: true, mintedCount: true } }),
  ]);
  const initial: BoxForm = box
    ? {
        name: box.name,
        slug: box.slug,
        tagline: box.tagline,
        description: box.description,
        price: box.price,
        theme: box.theme,
        isActive: box.isActive,
        featured: box.featured,
        sortOrder: box.sortOrder,
        rewards: box.rewards.map((r) => ({
          key: r.id,
          type: r.type,
          label: r.label,
          percent: String(r.weightPpm / 10_000),
          coins: String(r.coins ?? ""),
          packId: r.packId ?? "",
          collectibleId: r.collectibleId ?? "",
          fallbackCoins: String(r.fallbackCoins ?? 0),
          cards: r.cards.map((c) => ({ cardId: c.cardId, quantity: c.quantity, card: toCardView(c.card) })),
        })),
      }
    : { name: "", slug: "", tagline: "", description: "", price: 500, theme: "purple", isActive: false, featured: false, sortOrder: 50, rewards: [] };
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/admin/boxes"><ArrowLeft /> All boxes</Link>
      </Button>
      <AdminHeader title={box ? box.name : "New mystery box"} description={box ? `${box._count.openings.toLocaleString()} openings · odds v${box.oddsVersions[0]?.version ?? 0}` : "Configure details and rewards, then save to publish."} />
      <BoxEditor boxId={box?.id ?? null} initial={JSON.parse(JSON.stringify(initial))} packs={packs} collectibles={collectibles} />
    </>
  );
}
