"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Coins, ExternalLink, Gem, Heart, Layers, LayoutGrid, Library, LoaderCircle, PackageOpen, Rows3, Search, Sparkles, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RC } from "@/components/common/coin-icon";
import { EmptyState } from "@/components/common/page-header";
import { CardDetailView } from "@/components/cards/card-detail";
import { CardTile } from "@/components/cards/card-tile";
import { PokeCard } from "@/components/cards/poke-card";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { usePublicConfig } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCardActions } from "@/hooks/use-card-actions";
import { api } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { RARITIES, RARITY_META, rarityRank, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { CardDetail, CardView } from "@/server/services/cards";
import type { CollectionData } from "@/server/services/collection";
import { useCollectionView, type CollectionSort } from "@/stores/collection-view";

interface RecentPull {
  id: string;
  value: number;
  createdAt: string;
  packName: string;
  card: CardView;
}

const SORTS: { value: CollectionSort; label: string }[] = [
  { value: "value_desc", label: "Value: high to low" },
  { value: "value_asc", label: "Value: low to high" },
  { value: "recent", label: "Recently acquired" },
  { value: "rarity", label: "Rarity" },
  { value: "name", label: "Name" },
  { value: "quantity", label: "Quantity" },
];

export function CollectionView({ initial, recentPulls }: { initial: CollectionData; recentPulls: RecentPull[] }) {
  const { data = initial, isFetching } = useQuery({
    queryKey: ["collection"],
    queryFn: () => api<CollectionData>("/api/collection"),
    initialData: initial,
    staleTime: 5_000,
  });
  const view = useCollectionView();
  const [selected, setSelected] = useState<string | null>(null);
  const [dupesOpen, setDupesOpen] = useState(false);
  const { stats, entries, rarityDistribution, setProgress } = data;

  const filtered = useMemo(() => {
    const q = view.search.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (q && !`${e.card.name} ${e.card.pokemon ?? ""} ${e.card.set.name} ${e.card.number}`.toLowerCase().includes(q)) return false;
      if (view.rarities.length && !view.rarities.includes(e.card.rarity)) return false;
      if (view.set && e.card.set.code !== view.set) return false;
      if (view.onlyFavorites && !e.isFavorite) return false;
      if (view.onlyDuplicates && e.quantity < 2) return false;
      return true;
    });
    const sorters: Record<CollectionSort, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      value_desc: (a, b) => b.card.currentValue - a.card.currentValue,
      value_asc: (a, b) => a.card.currentValue - b.card.currentValue,
      recent: (a, b) => b.lastAcquiredAt.localeCompare(a.lastAcquiredAt),
      rarity: (a, b) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity) || b.card.currentValue - a.card.currentValue,
      name: (a, b) => a.card.name.localeCompare(b.card.name),
      quantity: (a, b) => b.quantity - a.quantity,
    };
    return [...list].sort(sorters[view.sort]);
  }, [entries, view.search, view.rarities, view.set, view.onlyFavorites, view.onlyDuplicates, view.sort]);

  const setsWithCards = setProgress.filter((s) => s.owned > 0 || s.total <= 30);
  const maxCopies = Math.max(1, ...rarityDistribution.map((r) => r.copies));
  const favorites = entries.filter((e) => e.isFavorite);
  const activeFilters = view.search || view.rarities.length || view.set || view.onlyFavorites || view.onlyDuplicates;

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Library className="size-10" />}
        title="Your vault is empty"
        description="Open your first pack to start your collection. Every card you pull lands here automatically."
        action={
          <Button asChild>
            <Link href="/packs">
              <PackageOpen /> Open packs
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className={cn("space-y-8 transition-opacity", isFetching && "opacity-90")}>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={<Layers className="size-4" />} label="Total cards" value={stats.totalCards.toLocaleString()} hint={`${stats.duplicates.toLocaleString()} duplicates`} />
        <Stat icon={<Gem className="size-4" />} label="Unique cards" value={stats.uniqueCards.toLocaleString()} hint={`of ${stats.catalogSize} in the catalog`} />
        <Stat icon={<Coins className="size-4" />} label="Collection value" value={<RC amount={stats.totalValue} compact className="text-amber-100" />} hint="Fictional virtual value" />
        <Stat icon={<Trophy className="size-4" />} label="Sets completed" value={stats.setsCompleted} hint={`of ${setProgress.length} sets`} />
        <div className="surface col-span-2 flex items-center gap-3 rounded-2xl border bg-card p-3 md:col-span-1">
          {stats.mostValuable ? (
            <>
              <button className="w-14 shrink-0" onClick={() => setSelected(stats.mostValuable!.card.id)} aria-label={`View ${stats.mostValuable.card.name}`}>
                <PokeCard card={stats.mostValuable.card} sizes="56px" />
              </button>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Most valuable</p>
                <p className="truncate text-sm font-semibold">{stats.mostValuable.card.name}</p>
                <RC amount={stats.mostValuable.card.currentValue} compact className="text-sm text-amber-200" />
              </div>
            </>
          ) : null}
        </div>
        <div className="surface col-span-2 rounded-2xl border bg-card p-4 md:col-span-1">
          <p className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Completion <BookOpen className="size-4" />
          </p>
          <p className="mt-2 font-display text-2xl font-bold">{(stats.completion * 100).toFixed(1)}%</p>
          <Progress value={stats.completion * 100} className="mt-2" />
        </div>
      </div>

      {/* Distribution + sets */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface rounded-2xl border bg-card p-5" aria-labelledby="dist-title">
          <h2 id="dist-title" className="font-display font-semibold">Rarity distribution</h2>
          <p className="mb-4 text-xs text-muted-foreground">Copies owned per rarity, with unique cards out of the catalog.</p>
          <ul className="space-y-2.5">
            {[...rarityDistribution].reverse().map((r) => (
              <li key={r.rarity} className="grid grid-cols-[104px_1fr_auto] items-center gap-3">
                <RarityBadge rarity={r.rarity} />
                <div className="h-3 overflow-hidden rounded-r-[4px] bg-white/[0.04]" title={`${r.copies} copies`}>
                  <div className="h-full rounded-r-[4px] bg-[var(--viz-accent)]" style={{ width: `${(r.copies / maxCopies) * 100}%` }} />
                </div>
                <span className="w-28 text-right text-xs tabular text-muted-foreground">
                  <span className="font-semibold text-foreground">{r.copies.toLocaleString()}</span> · {r.unique}/{r.total} unique
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="surface rounded-2xl border bg-card p-5" aria-labelledby="sets-title">
          <h2 id="sets-title" className="font-display font-semibold">Set progress</h2>
          <p className="mb-3 text-xs text-muted-foreground">Own every catalog card in a set to complete it.</p>
          <ul className="max-h-56 space-y-2 overflow-y-auto pr-2">
            {setsWithCards.map((s) => (
              <li key={s.id}>
                <button
                  className={cn("w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]", view.set === s.code && "bg-white/[0.06]")}
                  onClick={() => view.setSet(view.set === s.code ? null : s.code)}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">
                      {s.complete && <Sparkles className="mr-1 inline size-3.5 text-amber-300" />}
                      {s.name}
                    </span>
                    <span className="text-xs tabular text-muted-foreground">
                      {s.owned}/{s.total}
                    </span>
                  </div>
                  <Progress value={(s.owned / s.total) * 100} className="mt-1 h-1.5" indicatorClassName={s.complete ? "from-amber-300 to-amber-500" : undefined} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Tabs defaultValue="cards">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="cards">Cards ({entries.length})</TabsTrigger>
            <TabsTrigger value="recent">Recent pulls</TabsTrigger>
            <TabsTrigger value="favorites">Favourites ({favorites.length})</TabsTrigger>
          </TabsList>
          <Button variant="outline" onClick={() => setDupesOpen(true)} disabled={stats.duplicates === 0}>
            <Coins /> Sell duplicates
          </Button>
        </div>

        <TabsContent value="cards" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card/60 p-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={view.search} onChange={(e) => view.setSearch(e.target.value)} placeholder="Search Pokémon, card or set…" className="pl-9" aria-label="Search collection" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={view.set ?? "all"} onValueChange={(v) => view.setSet(v === "all" ? null : v)}>
                <SelectTrigger className="w-44" aria-label="Filter by set">
                  <SelectValue placeholder="All sets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sets</SelectItem>
                  {setProgress.map((s) => (
                    <SelectItem key={s.id} value={s.code}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={view.sort} onValueChange={(v) => view.setSort(v as CollectionSort)}>
                <SelectTrigger className="w-48" aria-label="Sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex rounded-lg border p-0.5">
                <Button variant="ghost" size="icon-sm" aria-label="Comfortable grid" aria-pressed={view.density === "comfortable"} className={cn(view.density === "comfortable" && "bg-white/10")} onClick={() => view.setDensity("comfortable")}>
                  <LayoutGrid />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Compact grid" aria-pressed={view.density === "compact"} className={cn(view.density === "compact" && "bg-white/10")} onClick={() => view.setDensity("compact")}>
                  <Rows3 />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[...RARITIES].reverse().map((r) => (
              <button
                key={r}
                onClick={() => view.toggleRarity(r)}
                aria-pressed={view.rarities.includes(r)}
                className={cn("rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors", view.rarities.includes(r) ? `${RARITY_META[r].border} bg-white/[0.07] text-foreground` : "text-muted-foreground hover:text-foreground")}
              >
                {RARITY_META[r].label}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={view.onlyFavorites} onCheckedChange={view.setOnlyFavorites} aria-label="Favourites only" /> Favourites
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={view.onlyDuplicates} onCheckedChange={view.setOnlyDuplicates} aria-label="Duplicates only" /> Duplicates
            </label>
            {activeFilters ? (
              <Button variant="ghost" size="sm" onClick={view.reset}>
                <X /> Clear
              </Button>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
              {filtered.length} of {entries.length} cards
            </span>
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="No cards match these filters" action={<Button variant="outline" onClick={view.reset}>Clear filters</Button>} />
          ) : (
            <div className={cn("grid gap-4", view.density === "compact" ? "grid-cols-3 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6")}>
              {filtered.map((e) => (
                <button key={e.card.id} className="text-left" onClick={() => setSelected(e.card.id)} aria-label={`View ${e.card.name}`}>
                  <CardTile card={e.card} quantity={e.quantity} listed={e.listed} favorite={e.isFavorite} compact={view.density === "compact"} />
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recent">
          {recentPulls.length === 0 ? (
            <EmptyState title="No pulls yet" description="Cards you rip from packs will show up here." />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {recentPulls.map((p) => (
                <button key={p.id} className="space-y-1 text-left" onClick={() => setSelected(p.card.id)}>
                  <CardTile card={p.card} />
                  <p className="text-[11px] text-muted-foreground">
                    {p.packName} · {timeAgo(p.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="favorites">
          {favorites.length === 0 ? (
            <EmptyState icon={<Heart className="size-8" />} title="No favourites yet" description="Open any card and tap “Add to favourites” to feature it on your profile showcase." />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {favorites.map((e) => (
                <button key={e.card.id} className="text-left" onClick={() => setSelected(e.card.id)}>
                  <CardTile card={e.card} quantity={e.quantity} favorite />
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CardQuickView cardId={selected} onClose={() => setSelected(null)} />
      <SellDuplicatesDialog open={dupesOpen} onOpenChange={setDupesOpen} entries={entries} />
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="surface rounded-2xl border bg-card p-4">
      <p className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label} {icon}
      </p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Premium card modal with large artwork, holo effect and all actions. */
export function CardQuickView({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => api<CardDetail>(`/api/cards/${cardId}`),
    enabled: Boolean(cardId),
  });
  return (
    <Dialog open={Boolean(cardId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] sm:max-w-5xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{data?.card.name ?? "Card details"}</DialogTitle>
          <DialogDescription>Card details, virtual price history and actions.</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            {error ? (error as Error).message : <LoaderCircle className="animate-spin" />}
          </div>
        ) : (
          <div className="space-y-3">
            <CardDetailView initial={data} compact />
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/collection/${data.card.id}`}>
                  Open full page <ExternalLink />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SellDuplicatesDialog({ open, onOpenChange, entries }: { open: boolean; onOpenChange: (o: boolean) => void; entries: CollectionData["entries"] }) {
  const { instantSellBps } = usePublicConfig();
  const { sellDuplicates } = useCardActions();
  const [rarities, setRarities] = useState<RarityKey[]>(["COMMON", "UNCOMMON"]);
  const [keep, setKeep] = useState(1);
  const estimate = entries
    .filter((e) => rarities.includes(e.card.rarity))
    .reduce(
      (acc, e) => {
        const free = e.quantity - e.listed;
        const n = Math.max(0, free - Math.max(0, keep - e.listed));
        return { cards: acc.cards + n, coins: acc.coins + n * Math.max(1, Math.floor((e.card.currentValue * instantSellBps) / 10_000)) };
      },
      { cards: 0, coins: 0 },
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sell duplicates</DialogTitle>
          <DialogDescription>Instantly sell extra copies back to the vault at {instantSellBps / 100}% of their virtual value. Listed cards are never sold.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {RARITIES.map((r) => (
              <label key={r} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <Checkbox checked={rarities.includes(r)} onCheckedChange={(v) => setRarities((prev) => (v ? [...prev, r] : prev.filter((x) => x !== r)))} />
                {RARITY_META[r].label}
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="keep">Copies to keep of each card</Label>
            <Select value={String(keep)} onValueChange={(v) => setKeep(Number(v))}>
              <SelectTrigger id="keep" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="rounded-lg bg-white/[0.04] p-3 text-sm">
            Sells <strong>{estimate.cards}</strong> cards for about <RC amount={estimate.coins} className="text-amber-200" />.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="gold"
            disabled={!rarities.length || estimate.cards === 0 || sellDuplicates.isPending}
            onClick={() => sellDuplicates.mutate({ rarities, keep }, { onSuccess: () => onOpenChange(false) })}
          >
            {sellDuplicates.isPending ? <LoaderCircle className="animate-spin" /> : <Coins />} Sell {estimate.cards} cards
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
