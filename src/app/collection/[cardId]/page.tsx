import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CardDetailView } from "@/components/cards/card-detail";
import { Container } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { orNotFound } from "@/server/page-helpers";
import { getCardDetail } from "@/server/services/cards";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ cardId: string }> }): Promise<Metadata> {
  const { cardId } = await params;
  try {
    const { card } = await getCardDetail(cardId);
    return { title: `${card.name} · ${card.set.name}` };
  } catch {
    return { title: "Card" };
  }
}

export default async function CardPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const user = await getSessionUser();
  const detail = await orNotFound(getCardDetail(cardId, user?.id));
  return (
    <Container className="pt-6">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={user ? "/collection" : "/marketplace"}>
          <ArrowLeft /> {user ? "My collection" : "Marketplace"}
        </Link>
      </Button>
      <CardDetailView initial={detail} />
    </Container>
  );
}
