import { PackageOpen, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CollectionView } from "@/components/collection/collection-view";
import { FictionalNote } from "@/components/common/fictional-note";
import { Container, PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { getCollection, getRecentPulls } from "@/server/services/collection";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "My Collection" };
export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  const user = await requireUser("/collection");
  const [collection, recent] = await Promise.all([getCollection(user.id), getRecentPulls(user.id, 18)]);
  return (
    <Container>
      <PageHeader
        eyebrow="Your vault"
        title="My Collection"
        description="Every card you own, with live fictional values, set progress and quick actions."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/marketplace">
                <Store /> Marketplace
              </Link>
            </Button>
            <Button asChild>
              <Link href="/packs">
                <PackageOpen /> Open packs
              </Link>
            </Button>
          </>
        }
      />
      <CollectionView initial={collection} recentPulls={recent} />
      <FictionalNote className="mt-8" />
    </Container>
  );
}
