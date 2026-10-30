import { CalendarDays, Coins, EyeOff, Flame, Gem, Layers, Lock, PackageOpen, Pencil, Trophy } from "lucide-react";
import Link from "next/link";
import { CollectibleBadge } from "@/components/boxes/collectible-badge";
import { RC } from "@/components/common/coin-icon";
import { EmptyState, SectionHeading } from "@/components/common/page-header";
import { UserAvatar } from "@/components/common/user-avatar";
import { PokeCard } from "@/components/cards/poke-card";
import { TiltCard } from "@/components/cards/tilt-card";
import { AchievementBadge, TIER_STYLE } from "@/components/rewards/achievements-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import type { ProfileData } from "@/server/services/profiles";

export function ProfileView({ profile }: { profile: ProfileData }) {
  if (profile.private) {
    return (
      <div className="space-y-6 pt-10">
        <div className="flex items-center gap-4">
          <UserAvatar avatar={profile.avatar} image={profile.image} username={profile.username} className="size-16 text-2xl" />
          <div>
            <h1 className="font-display text-3xl font-bold">{profile.username}</h1>
            <p className="text-sm text-muted-foreground">Level {profile.level}</p>
          </div>
        </div>
        <EmptyState icon={<Lock className="size-8" />} title="This collection is private" description="This collector has chosen to keep their profile and showcase private." />
      </div>
    );
  }
  const s = profile.stats;
  return (
    <div className="space-y-10 pt-8">
      <section className="surface relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(139,92,246,.35),transparent_45%),radial-gradient(circle_at_90%_100%,rgba(34,211,238,.18),transparent_45%)]" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <UserAvatar avatar={profile.avatar} image={profile.image} username={profile.username} className="size-24 text-4xl ring-4 ring-violet-500/30" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-bold sm:text-4xl">{profile.username}</h1>
              {profile.isBot && <Badge variant="outline">Demo collector</Badge>}
              {profile.profileVisibility === "PRIVATE" && (
                <Badge variant="secondary">
                  <EyeOff /> Private
                </Badge>
              )}
            </div>
            {profile.bio && <p className="max-w-xl text-sm text-muted-foreground">{profile.bio}</p>}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> Joined {formatDate(profile.joinedAt, { month: "long", year: "numeric" })}</span>
              <span className="flex items-center gap-1"><Flame className="size-3.5" /> {profile.loginStreak}-day streak</span>
            </div>
            <div className="flex max-w-md items-center gap-3">
              <span className="rounded-lg bg-violet-500/20 px-2.5 py-1 font-display text-sm font-bold text-violet-100">Lv {profile.level}</span>
              <Progress value={profile.progress.progress * 100} className="flex-1" />
              <span className="text-[11px] tabular text-muted-foreground">{profile.progress.isMax ? "MAX" : `${profile.progress.xpIntoLevel}/${profile.progress.xpForNext} XP`}</span>
            </div>
          </div>
          {profile.isOwner && (
            <Button variant="outline" asChild className="self-start">
              <Link href="/settings"><Pencil /> Edit profile</Link>
            </Button>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={<Coins className="size-4" />} label="Collection value" value={<RC amount={s.collectionValue} compact className="text-amber-100" />} />
        <Stat icon={<PackageOpen className="size-4" />} label="Packs opened" value={profile.packsOpened.toLocaleString()} hint={`${profile.boxesOpened} mystery boxes`} />
        <Stat icon={<Layers className="size-4" />} label="Cards" value={s.totalCards.toLocaleString()} />
        <Stat icon={<Gem className="size-4" />} label="Unique cards" value={s.uniqueCards.toLocaleString()} />
        <Stat icon={<Trophy className="size-4" />} label="Sets completed" value={s.setsCompleted} />
        <div className="surface flex items-center gap-3 rounded-2xl border bg-card p-3">
          {s.biggestPull ? (
            <>
              <Link href={`/collection/${s.biggestPull.card.id}`} className="w-12 shrink-0"><PokeCard card={s.biggestPull.card} sizes="48px" /></Link>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Biggest pull</p>
                <p className="truncate text-sm font-semibold">{s.biggestPull.card.name}</p>
                <RC amount={s.biggestPull.value} compact className="text-xs text-amber-200" />
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No pulls yet</p>
          )}
        </div>
      </section>

      <section>
        <SectionHeading title="Achievement badges" description={`${profile.achievements.length} unlocked`} />
        {profile.achievements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No badges yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {profile.achievements.map((a) => (
              <Tooltip key={a.key}>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <AchievementBadge icon={a.icon} tier={a.tier} className="size-14" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-semibold">{a.name} <span className={TIER_STYLE[a.tier]?.text}>· {TIER_STYLE[a.tier]?.label}</span></p>
                  <p className="text-muted-foreground">{a.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </section>

      {profile.favorites.length > 0 && (
        <section>
          <SectionHeading title="Favourite cards" />
          <CardRow cards={profile.favorites} />
        </section>
      )}

      <section>
        <SectionHeading title="Collection showcase" description="The most valuable cards in this vault." />
        {profile.showcase.length === 0 ? <p className="text-sm text-muted-foreground">Nothing to show yet.</p> : <CardRow cards={profile.showcase} />}
      </section>

      {profile.collectibles.length > 0 && (
        <section>
          <SectionHeading title="Limited collectibles" />
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-8">
            {profile.collectibles.map((c) => (
              <div key={c.id} className="space-y-1.5 text-center">
                <CollectibleBadge icon={c.icon} rarity={c.rarity} serial={c.serialNumber} maxSupply={c.maxSupply} />
                <p className="truncate text-xs font-semibold">{c.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CardRow({ cards }: { cards: ProfileData extends infer P ? (P extends { showcase: infer S } ? S : never) : never }) {
  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-8">
      {cards.map((card) => (
        <Link key={card.id} href={`/collection/${card.id}`} className="space-y-1.5">
          <TiltCard max={10}>
            <PokeCard card={card} sizes="160px" />
          </TiltCard>
          <p className="truncate text-xs font-semibold">{card.name}</p>
          <RC amount={card.currentValue} compact className="text-[11px] text-amber-200" />
        </Link>
      ))}
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="surface rounded-2xl border bg-card p-4">
      <p className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label} {icon}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
