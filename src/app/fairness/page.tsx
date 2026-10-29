import { Ban, Dices, FileSearch, Fingerprint, Scale, ServerCog } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/common/page-header";
import { OddsTable } from "@/components/packs/odds-table";
import { Button } from "@/components/ui/button";
import { FICTIONAL_DISCLAIMER } from "@/lib/constants";
import { listPacks } from "@/server/services/packs";

export const metadata: Metadata = { title: "How odds work" };
export const dynamic = "force-dynamic";

const POINTS = [
  {
    icon: ServerCog,
    title: "Decided on the server, before the show",
    body: "When you open a pack, our server draws every card with Node's cryptographically secure random number generator, charges your Rip Coins and saves the cards — all in one database transaction — before the response reaches your browser. The tearing, flipping and confetti are purely cosmetic and cannot change the result.",
  },
  {
    icon: Dices,
    title: "Two-step weighted draw",
    body: "Each card slot first rolls a rarity tier using the published odds (in parts per million, summing to exactly 100%). It then picks a card inside that tier proportionally to its published weight. The exact chance of every individual card is listed on each pack page.",
  },
  {
    icon: Ban,
    title: "No personalised odds",
    body: "The probability engine never receives your user id, balance, spending or history. Every collector draws from identical odds, and there are no pity timers, streak adjustments or hidden boosts.",
  },
  {
    icon: Fingerprint,
    title: "Versioned, hashed odds",
    body: "Every change to a pack's odds or card pool creates a new immutable odds version with a SHA-256 hash, shown on the pack page. Each opening stores the version it used, so odds can never change silently.",
  },
  {
    icon: FileSearch,
    title: "Auditable openings",
    body: "Every pulled card stores its raw rarity roll and card roll. Replaying those numbers against the stored odds version reproduces the exact card — administrators can verify any opening, and our test-suite simulates millions of draws to confirm the distribution matches the published odds.",
  },
  {
    icon: Scale,
    title: "Fictional values, honest expectations",
    body: "Pack pages show the expected virtual value per pack at current fictional prices. Most packs return less than their price on average — that's how the virtual economy stays balanced — and big hits are rare by design.",
  },
];

export default async function FairnessPage() {
  const packs = await listPacks();
  const sample = packs.find((p) => p.slug === "trainer") ?? packs[0];
  return (
    <Container className="max-w-5xl">
      <PageHeader eyebrow="Fair play" title="How odds work" description="Transparency is a core feature of RipVault. Here's exactly how every pull is decided." />
      <div className="grid gap-4 md:grid-cols-2">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <section key={title} className="surface space-y-2 rounded-2xl border bg-card p-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <Icon className="size-5" />
            </span>
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </section>
        ))}
      </div>
      {sample && (
        <section className="mt-10 space-y-3">
          <h2 className="font-display text-xl font-bold">Example: {sample.name}</h2>
          <p className="text-sm text-muted-foreground">
            {sample.cardsPerPack} cards per pack, each drawn independently with these published odds (version {sample.oddsVersion}).
          </p>
          <OddsTable odds={sample.odds} cardsPerPack={sample.cardsPerPack} />
          <Button variant="outline" asChild>
            <Link href={`/packs/${sample.slug}`}>See every card&apos;s exact chance</Link>
          </Button>
        </section>
      )}
      <section className="mt-10 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-5 text-sm text-amber-100">
        <h2 className="mb-1 font-display font-semibold">No real money, ever</h2>
        <p>{FICTIONAL_DISCLAIMER} There are no purchases, withdrawals, cash prizes, cryptocurrency or redeemable rewards anywhere on RipVault.</p>
      </section>
    </Container>
  );
}
