import { ArrowRight, CalendarCheck, Coins, Gem, Layers, PackageOpen, ShieldCheck, Sparkles, Store, TrendingDown, TrendingUp, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { LiveFeed } from "@/components/activity/live-feed";
import { RC } from "@/components/common/coin-icon";
import { FictionalNote } from "@/components/common/fictional-note";
import { Container, SectionHeading } from "@/components/common/page-header";
import { PokeCard } from "@/components/cards/poke-card";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { HeroPack } from "@/components/home/hero-pack";
import { PackShopCard } from "@/components/packs/pack-shop-card";
import { AchievementBadge } from "@/components/rewards/achievements-grid";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatPercentChange, timeAgo } from "@/lib/format";
import { levelProgress } from "@/lib/levels";
import { prisma } from "@/server/db";
import { listActivity } from "@/server/services/activity";
import { getTrendingCards } from "@/server/services/cards";
import { getTopPulls } from "@/server/services/leaderboards";
import { listPacks } from "@/server/services/packs";
import { getProfileStats } from "@/server/services/profiles";
import { getWalletState } from "@/server/services/session-state";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  const [packs, topPulls, trending, activity, platform] = await Promise.all([
    listPacks(),
    getTopPulls(6, 7),
    getTrendingCards(5),
    listActivity({ limit: 8, types: ["BIG_PULL", "MYSTERY_BOX_WIN"] }),
    Promise.all([prisma.user.count({ where: { suspendedAt: null } }), prisma.packOpening.count(), prisma.card.count({ where: { isActive: true } })]),
  ]);
  const hero = packs.find((p) => p.slug === "legendary") ?? packs.find((p) => p.featured) ?? packs[0];
  const featured = packs.filter((p) => p.featured).slice(0, 3);
  const personal = user
    ? await Promise.all([
        getProfileStats(user.id),
        getWalletState(user.id),
        prisma.userAchievement.findMany({ where: { userId: user.id }, orderBy: { unlockedAt: "desc" }, take: 4, include: { achievement: true } }),
      ])
    : null;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <Container className="grid items-center gap-6 pb-10 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
              <Sparkles className="size-3.5" /> Virtual card ripping · fictional currency only
            </span>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Rip packs. <span className="text-gradient-brand">Chase grails.</span>
              <br />
              Zero real money.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Open cinematic booster packs, reveal holo chase cards, build your vault and trade with collectors — all with free Rip Coins that can never be bought or cashed out.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xl" asChild>
                <Link href={hero ? `/open/${hero.slug}` : "/packs"}>
                  <PackageOpen /> Open packs
                </Link>
              </Button>
              {user ? (
                <div className="flex items-center gap-3 rounded-xl border bg-card/70 px-4 py-3">
                  <span className="text-xs text-muted-foreground">Balance</span>
                  <RC amount={personal?.[1].balance ?? 0} className="text-lg text-amber-100" />
                </div>
              ) : (
                <Button size="xl" variant="outline" asChild>
                  <Link href="/register">Get 10,000 RC free</Link>
                </Button>
              )}
            </div>
            <dl className="flex flex-wrap gap-6 pt-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Collectors</dt>
                <dd className="font-display text-xl font-bold">{platform[0].toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Packs ripped</dt>
                <dd className="font-display text-xl font-bold">{platform[1].toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cards in the vault</dt>
                <dd className="font-display text-xl font-bold">{platform[2].toLocaleString()}</dd>
              </div>
            </dl>
          </div>
          {hero && (
            <div className="space-y-2">
              <HeroPack theme={hero.theme} name={hero.name} cards={hero.cardsPerPack} chase={hero.chaseCards} />
              <p className="text-center text-sm text-muted-foreground">
                Featured: <Link href={`/packs/${hero.slug}`} className="font-semibold text-foreground hover:underline">{hero.name}</Link> · <RC amount={hero.price} className="text-amber-200" />
              </p>
            </div>
          )}
        </Container>
      </section>

      <Container className="space-y-16">
        {/* Personal progress */}
        {user && personal && (
          <section aria-labelledby="your-vault">
            <SectionHeading title={<span id="your-vault">Your vault</span>} action={<Button variant="ghost" asChild><Link href="/collection">My collection <ArrowRight /></Link></Button>} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="surface rounded-2xl border bg-card p-5">
                <p className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">Collection value <Coins className="size-4" /></p>
                <RC amount={personal[0].collectionValue} className="mt-2 text-2xl text-amber-100" />
                <p className="mt-1 text-xs text-muted-foreground">{personal[0].totalCards.toLocaleString()} cards · {personal[0].uniqueCards} unique</p>
              </div>
              <div className="surface rounded-2xl border bg-card p-5">
                <p className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">Level <Gem className="size-4" /></p>
                {(() => {
                  const lp = levelProgress(user.xp);
                  return (
                    <>
                      <p className="mt-2 font-display text-2xl font-bold">Level {lp.level}</p>
                      <Progress value={lp.progress * 100} className="mt-2" />
                      <p className="mt-1 text-xs text-muted-foreground tabular">{lp.isMax ? "Max level" : `${lp.xpIntoLevel}/${lp.xpForNext} XP`}</p>
                    </>
                  );
                })()}
              </div>
              <div className="surface flex flex-col justify-between rounded-2xl border bg-card p-5">
                <p className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">Daily reward <CalendarCheck className="size-4" /></p>
                <p className="mt-2 text-sm">{personal[1].dailyClaimable ? "Your daily reward is ready to claim." : "Claimed today — come back tomorrow."}</p>
                <Button size="sm" variant={personal[1].dailyClaimable ? "gold" : "outline"} asChild className="mt-3">
                  <Link href="/rewards">{personal[1].dailyClaimable ? "Claim now" : "View missions"}</Link>
                </Button>
              </div>
              <div className="surface rounded-2xl border bg-card p-5">
                <p className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">Recent achievements <Trophy className="size-4" /></p>
                {personal[2].length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">Open your first pack to unlock “First Rip”.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {personal[2].map((a) => (
                      <li key={a.achievementId} className="flex items-center gap-2 text-sm">
                        <AchievementBadge icon={a.achievement.icon} tier={a.achievement.tier} className="size-8 rounded-xl [&_svg]:size-4" />
                        <span className="truncate">{a.achievement.name}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{timeAgo(a.unlockedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Featured packs */}
        <section aria-labelledby="featured-packs">
          <SectionHeading title={<span id="featured-packs">Featured packs</span>} description="Published odds on every pack. Pick a tier and rip." action={<Button variant="ghost" asChild><Link href="/packs">All packs <ArrowRight /></Link></Button>} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <PackShopCard key={p.id} pack={p} vouchers={personal?.[1].vouchers[p.id] ?? 0} />
            ))}
          </div>
        </section>

        {/* Big pulls + live feed */}
        <section className="grid gap-6 lg:grid-cols-[1fr_380px]" aria-labelledby="big-pulls">
          <div>
            <SectionHeading title={<span id="big-pulls">Biggest pulls this week</span>} description="The most valuable cards ripped in the last 7 days." action={<Button variant="ghost" asChild><Link href="/leaderboards">Leaderboards <ArrowRight /></Link></Button>} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {topPulls.map((p) => (
                <Link key={p.id} href={`/collection/${p.card.id}`} className="group surface space-y-2 rounded-2xl border bg-card p-3">
                  <div className="transition-transform group-hover:-translate-y-1">
                    <PokeCard card={p.card} sizes="200px" />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-sm font-semibold">{p.card.name}</p>
                    <RarityBadge rarity={p.rarity} short />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{p.user.username}</span>
                    <RC amount={p.value} compact className="text-amber-200" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{p.pack.name} · {timeAgo(p.createdAt)}</p>
                </Link>
              ))}
            </div>
          </div>
          <LiveFeed initial={activity} type="pulls" limit={8} className="h-fit lg:mt-12" />
        </section>

        {/* Trending */}
        <section aria-labelledby="trending">
          <SectionHeading title={<span id="trending">Trending cards</span>} description="Biggest 24h movers in the simulated, fictional market." action={<Button variant="ghost" asChild><Link href="/marketplace">Marketplace <Store /></Link></Button>} />
          <div className="grid gap-4 md:grid-cols-2">
            {([
              ["Top gainers", trending.gainers, TrendingUp, "text-emerald-300"],
              ["Top decliners", trending.losers, TrendingDown, "text-rose-300"],
            ] as const).map(([title, list, Icon, color]) => (
              <div key={title} className="surface rounded-2xl border bg-card">
                <p className={`flex items-center gap-2 border-b px-4 py-3 font-display font-semibold`}>
                  <Icon className={`size-4 ${color}`} /> {title}
                </p>
                <ul className="divide-y">
                  {list.map(({ card, change }) => (
                    <li key={card.id}>
                      <Link href={`/collection/${card.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                        <span className="w-8 shrink-0"><PokeCard card={card} sizes="32px" holo={false} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{card.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{card.variant ? `${card.variant} · ` : ""}{card.set.name}</span>
                        </span>
                        <RC amount={card.currentValue} compact className="text-sm" />
                        <span className={`w-16 text-right text-sm font-semibold tabular ${color}`}>{formatPercentChange(change?.d1)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <FictionalNote className="mt-3" />
        </section>

        {/* How it works */}
        <section className="surface grid gap-6 rounded-3xl border bg-card p-6 sm:p-10 md:grid-cols-3" aria-labelledby="how">
          <h2 id="how" className="sr-only">How RipVault works</h2>
          {[
            { icon: Coins, title: "Free Rip Coins", body: "Start with 10,000 RC and earn more every day from logins, missions, achievements and level-ups. RC can never be purchased or withdrawn." },
            { icon: ShieldCheck, title: "Provably transparent", body: "Every pack and box publishes exact odds and an auditable odds version. Results are drawn on the server with a CSPRNG before any animation plays." },
            { icon: Users, title: "Collect & compete", body: "Complete sets, trade on the marketplace and climb the leaderboards. Your vault, your showcase — all fictional fun." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="space-y-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><Icon className="size-5" /></span>
              <h3 className="font-display text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 md:col-span-3">
            <Button asChild><Link href="/packs"><Layers /> Browse packs</Link></Button>
            <Button variant="outline" asChild><Link href="/fairness"><ShieldCheck /> How odds work</Link></Button>
          </div>
        </section>
      </Container>
    </>
  );
}
