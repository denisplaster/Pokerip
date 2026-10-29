import type { Metadata } from "next";
import { FictionalNote } from "@/components/common/fictional-note";
import { Container, PageHeader } from "@/components/common/page-header";
import { MarketplaceView } from "@/components/market/marketplace-view";
import { prisma } from "@/server/db";
import { searchListings } from "@/server/services/marketplace";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Marketplace" };
export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const [sets, listings, { economy }] = await Promise.all([
    prisma.cardSet.findMany({ where: { cards: { some: { listings: { some: { status: "ACTIVE" } } } } }, orderBy: { name: "asc" }, select: { code: true, name: true } }),
    searchListings({ sort: "newest", page: 1, limit: 24 }),
    getSettings(),
  ]);
  return (
    <Container>
      <PageHeader
        eyebrow="Player marketplace"
        title="Marketplace"
        description={`Buy and sell cards with other collectors using Rip Coins only. Sellers pay a ${economy.marketplaceFeeBps / 100}% fee; nothing here can be exchanged for real money.`}
      />
      <MarketplaceView sets={sets} initialListings={listings} />
      <FictionalNote className="mt-8" />
    </Container>
  );
}
