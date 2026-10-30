import { Gift, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/common/page-header";
import { FictionalNote } from "@/components/common/fictional-note";
import { PackShopCard } from "@/components/packs/pack-shop-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { listPacks } from "@/server/services/packs";
import { getWalletState } from "@/server/services/session-state";
import { getSessionUser } from "@/server/session";

export const metadata: Metadata = { title: "Open Packs" };
export const dynamic = "force-dynamic";

export default async function PacksPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [{ welcome }, packs, user] = await Promise.all([searchParams, listPacks(), getSessionUser()]);
  const wallet = user ? await getWalletState(user.id) : null;
  return (
    <Container>
      <PageHeader
        eyebrow="Pack shop"
        title="Open packs"
        description="Every pack publishes exact odds. Outcomes are drawn on our server with a cryptographically secure RNG before the animation starts — the show never changes the result."
        actions={
          <Button variant="outline" asChild>
            <Link href="/fairness">
              <ShieldCheck /> How odds work
            </Link>
          </Button>
        }
      />
      {welcome && (
        <Alert variant="gold" className="mb-6">
          <Sparkles />
          <AlertTitle>Welcome to RipVault!</AlertTitle>
          <AlertDescription>
            Your 10,000 Rip Coins are ready. Try a Starter or Trainer Pack, then claim your free daily reward on the Rewards page.
          </AlertDescription>
        </Alert>
      )}
      {wallet && Object.keys(wallet.vouchers).length > 0 && (
        <Alert variant="info" className="mb-6">
          <Gift />
          <AlertTitle>You have free pack vouchers</AlertTitle>
          <AlertDescription>Packs marked “free” can be opened at no cost — pick “Use voucher” on the opening screen.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {packs.map((pack) => (
          <PackShopCard key={pack.id} pack={pack} vouchers={wallet?.vouchers[pack.id] ?? 0} />
        ))}
      </div>
      <FictionalNote className="mt-8" />
    </Container>
  );
}
