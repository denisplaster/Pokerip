import { Clock, Fingerprint, PackageOpen, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RC } from "@/components/common/coin-icon";
import { Container, SectionHeading } from "@/components/common/page-header";
import { FictionalNote } from "@/components/common/fictional-note";
import { PokeCard } from "@/components/cards/poke-card";
import { TiltCard } from "@/components/cards/tilt-card";
import { OddsTable } from "@/components/packs/odds-table";
import { PackArt } from "@/components/packs/pack-art";
import { PackCardList } from "@/components/packs/pack-card-list";
import { packTheme } from "@/components/packs/pack-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { orNotFound } from "@/server/page-helpers";
import { getPackDetail } from "@/server/services/packs";

export const dynamic = "force-dynamic";


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const { pack } = await getPackDetail(id);
    return { title: pack.name, description: pack.description };
  } catch {
    return { title: "Pack" };
  }
}

export default async function PackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pack, cards, history, oddsHash } = await orNotFound(getPackDetail(id));
  const theme = packTheme(pack.theme);
  return (
    <Container className="pt-8">
      <section className="relative grid gap-10 lg:grid-cols-[380px_1fr]">
        <div className="absolute -top-20 left-0 h-80 w-80 rounded-full opacity-30 blur-3xl" style={{ background: theme.glow }} aria-hidden />
        <div className="relative mx-auto w-64 sm:w-72 lg:w-full">
          <TiltCard max={10}>
            <div className="animate-float">
              <PackArt theme={pack.theme} name={pack.name} cards={pack.cardsPerPack} />
            </div>
          </TiltCard>
        </div>
        <div className="relative space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {pack.featured && <Badge variant="gold">Featured</Badge>}
              {!pack.isActive && <Badge variant="destructive">Unavailable</Badge>}
              <Badge variant="outline">
                <Fingerprint /> Odds v{pack.oddsVersion}
              </Badge>
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight">{pack.name}</h1>
            <p className="max-w-2xl text-muted-foreground">{pack.description}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Price" value={<RC amount={pack.price} className="text-amber-200" />} />
            <Stat label="Cards per pack" value={pack.cardsPerPack} />
            <Stat label="Expected value" value={<RC amount={pack.expectedValue} className="text-cyan-200" />} hint={`${Math.round((pack.expectedValue / Math.max(1, pack.price)) * 100)}% of price`} />
            <Stat label="Value range" value={<span className="text-base"><RC amount={pack.valueRange.min} compact /> – <RC amount={pack.valueRange.max} compact /></span>} />
          </dl>
          <div className="flex flex-wrap gap-2">
            {[1, 5, 10].map((q) => (
              <Button key={q} asChild size="lg" variant={q === 1 ? "default" : "outline"} disabled={!pack.isActive}>
                <Link href={`/open/${pack.slug}?qty=${q}`}>
                  <PackageOpen /> Open {q > 1 ? `${q}×` : "pack"} · <RC amount={pack.price * q} />
                </Link>
              </Button>
            ))}
          </div>
          <FictionalNote>
            Expected value uses current fictional market values and the published odds. It is an average over many packs, not a promise for any single pack.
          </FictionalNote>
        </div>
      </section>

      <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionHeading title="Published odds" description="Probability for every card slot. Each slot is drawn independently." />
          <OddsTable odds={pack.odds} cardsPerPack={pack.cardsPerPack} />
          <div className="mt-4 space-y-2 rounded-xl border bg-white/[0.02] p-4 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <Clock className="size-3.5" /> Odds history
            </p>
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.version} className="flex items-center justify-between gap-2">
                  <span>
                    v{h.version} · {formatDate(h.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <code className="truncate font-mono text-[10px] text-muted-foreground" title={h.hash}>
                    {h.hash.slice(0, 16)}…
                  </code>
                </li>
              ))}
            </ul>
            <p>
              Current snapshot hash <code className="font-mono text-[10px]">{oddsHash.slice(0, 24)}…</code>. Every opening records the version it used, so
              results can be audited.
            </p>
          </div>
        </div>
        <div>
          <SectionHeading title={<span className="flex items-center gap-2"><Sparkles className="size-5 text-amber-300" /> Featured chase cards</span>} description="The most valuable cards in this pack's pool." />
          <div className="grid grid-cols-3 gap-4">
            {pack.chaseCards.slice(0, 6).map((card) => (
              <Link key={card.id} href={`/collection/${card.id}`} className="group space-y-1.5">
                <TiltCard max={8}>
                  <PokeCard card={card} sizes="200px" />
                </TiltCard>
                <p className="truncate text-xs font-semibold">{card.name}</p>
                <RC amount={card.currentValue} compact className="text-xs text-amber-200" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-14">
        <SectionHeading title="Available cards" description={`All ${cards.length} cards that can drop from this pack, with their exact chance per card slot.`} />
        <PackCardList cards={cards} />
      </section>
    </Container>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border bg-white/[0.03] p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-lg font-bold tabular">{value}</dd>
      {hint && <dd className="text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}
