import type { Metadata } from "next";
import { MysteryBoxesView } from "@/components/boxes/mystery-boxes-view";
import { FictionalNote } from "@/components/common/fictional-note";
import { Container, PageHeader } from "@/components/common/page-header";
import { listBoxes } from "@/server/services/mystery-boxes";

export const metadata: Metadata = { title: "Mystery Boxes" };
export const dynamic = "force-dynamic";

export default async function MysteryBoxesPage() {
  const boxes = await listBoxes();
  return (
    <Container>
      <PageHeader
        eyebrow="Mystery boxes"
        title="Mystery Boxes"
        description="Card bundles, coin caches, free packs and limited-edition digital collectibles. Every box publishes its exact odds, and outcomes are drawn securely on the server."
      />
      <MysteryBoxesView boxes={boxes} />
      <FictionalNote className="mt-8">
        Limited collectibles have a fixed supply. If one sells out, its published coin fallback is awarded instead, and that is shown in the odds before you open.
      </FictionalNote>
    </Container>
  );
}
