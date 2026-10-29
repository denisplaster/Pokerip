"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, LoaderCircle, Lock, Search, ShoppingCart, Tag, Undo2 } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { RC } from "@/components/common/coin-icon";
import { EmptyState } from "@/components/common/page-header";
import { PokeCard } from "@/components/cards/poke-card";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { useUser } from "@/components/providers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCardActions } from "@/hooks/use-card-actions";
import { useWallet } from "@/hooks/use-wallet";
import { MARKETPLACE_MIN_LEVEL } from "@/lib/market-rules";
import { api } from "@/lib/api-client";
import { formatPercentChange, timeAgo } from "@/lib/format";
import { RARITIES, RARITY_META, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { CardView, PriceChanges } from "@/server/services/cards";
import type { ListingView } from "@/server/services/marketplace";
import { BuyDialog, type BuyableListing } from "./buy-dialog";
import { SellPicker } from "./sell-picker";

type Sort = "newest" | "price_asc" | "price_desc" | "value_ratio";

interface ListingsPage {
  items: ListingView[];
  total: number;
  page: number;
  pages: number;
}

interface Sale {
  id: string;
  price: number;
  fee: number;
  createdAt: string;
  viewerRole: "buyer" | "seller" | null;
  buyer: { username: string };
  seller: { username: string };
  card: CardView;
}

export function MarketplaceView({ sets, initialListings }: { sets: { code: string; name: string }[]; initialListings: ListingsPage }) {
  const user = useUser();
  const { data: wallet } = useWallet(Boolean(user));
  const [tab, setTab] = useState("browse");
  const [sellOpen, setSellOpen] = useState(false);
  const locked = Boolean(user) && (wallet?.level ?? user?.level ?? 1) < MARKETPLACE_MIN_LEVEL;
  return (
    <Tabs value={tab} onValueChange={setTab}>
      {locked && (
        <Alert variant="info">
          <Lock />
          <AlertTitle>Trading unlocks at level {MARKETPLACE_MIN_LEVEL}</AlertTitle>
          <AlertDescription>
            You can browse everything now. Open a few packs or claim daily rewards to level up, then buy and list cards.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          {user && <TabsTrigger value="mine">My listings</TabsTrigger>}
          <TabsTrigger value="history">Sale history</TabsTrigger>
          <TabsTrigger value="index">Price index</TabsTrigger>
        </TabsList>
        {user ? (
          <Button onClick={() => setSellOpen(true)} disabled={locked}>
            <Tag /> Sell a card
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link href="/login?callbackUrl=/marketplace">Sign in to trade</Link>
          </Button>
        )}
      </div>
      <TabsContent value="browse">
        <Browse sets={sets} initial={initialListings} />
      </TabsContent>
      {user && (
        <TabsContent value="mine">
          <MyListings />
        </TabsContent>
      )}
      <TabsContent value="history">
        <SaleHistory />
      </TabsContent>
      <TabsContent value="index">
        <PriceIndex />
      </TabsContent>
      {user && <SellPicker open={sellOpen} onOpenChange={setSellOpen} />}
    </Tabs>
  );
}

function ValueRatio({ ratio }: { ratio: number | null }) {
  if (ratio === null) return null;
  const pct = Math.round((ratio - 1) * 100);
  if (Math.abs(pct) < 1) return <Badge variant="outline">At value</Badge>;
  return pct < 0 ? <Badge variant="success">{-pct}% below value</Badge> : <Badge variant="secondary">{pct}% above value</Badge>;
}

function Browse({ sets, initial }: { sets: { code: string; name: string }[]; initial: ListingsPage }) {
  const user = useUser();
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<RarityKey | "all">("all");
  const [set, setSet] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  const [buying, setBuying] = useState<BuyableListing | null>(null);
  const deferredQ = useDeferredValue(q);
  const params = new URLSearchParams({ sort, page: String(page), limit: "24" });
  if (deferredQ) params.set("q", deferredQ);
  if (rarity !== "all") params.set("rarity", rarity);
  if (set !== "all") params.set("set", set);
  const isDefault = !deferredQ && rarity === "all" && set === "all" && sort === "newest" && page === 1;
  const { data, isFetching } = useQuery({
    queryKey: ["listings", params.toString()],
    queryFn: () => api<ListingsPage>(`/api/marketplace/listings?${params}`),
    placeholderData: keepPreviousData,
    initialData: isDefault ? initial : undefined,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card/60 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search listings by Pokémon, card or set…"
            className="pl-9"
            aria-label="Search listings"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={rarity} onValueChange={(v) => { setRarity(v as RarityKey | "all"); setPage(1); }}>
            <SelectTrigger className="w-40" aria-label="Rarity"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rarities</SelectItem>
              {[...RARITIES].reverse().map((r) => (
                <SelectItem key={r} value={r}>{RARITY_META[r].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={set} onValueChange={(v) => { setSet(v); setPage(1); }}>
            <SelectTrigger className="w-44" aria-label="Set"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sets</SelectItem>
              {sets.map((s) => (
                <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => { setSort(v as Sort); setPage(1); }}>
            <SelectTrigger className="w-44" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price: low to high</SelectItem>
              <SelectItem value="price_desc">Price: high to low</SelectItem>
              <SelectItem value="value_ratio">Best deals</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span aria-live="polite">{data ? `${data.total.toLocaleString()} active listings` : "Loading…"}</span>
        {isFetching && <LoaderCircle className="size-4 animate-spin" />}
      </div>
      {!data ? (
        <div className="flex h-40 items-center justify-center"><LoaderCircle className="animate-spin text-muted-foreground" /></div>
      ) : data.items.length === 0 ? (
        <EmptyState title="No listings found" description="Try a different search, or list one of your own cards." />
      ) : (
        <div className={cn("grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6", isFetching && "opacity-70")}>
          {data.items.map((l) => {
            const mine = l.isMine;
            return (
              <article key={l.id} className="group flex flex-col gap-2 rounded-2xl border bg-card/70 p-2.5">
                <Link href={`/collection/${l.card.id}`} className="block transition-transform group-hover:-translate-y-1">
                  <PokeCard card={l.card} sizes="200px" />
                </Link>
                <div className="min-w-0 space-y-1 px-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-sm font-semibold">{l.card.name}</p>
                    <RarityBadge rarity={l.card.rarity} short />
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{l.card.set.name} · by {l.seller.username}</p>
                  <div className="flex items-center justify-between gap-1">
                    <RC amount={l.price} compact className="text-amber-200" />
                    <ValueRatio ratio={l.valueRatio} />
                  </div>
                </div>
                {mine ? (
                  <Button size="sm" variant="outline" disabled>Your listing</Button>
                ) : user ? (
                  <Button size="sm" onClick={() => setBuying(l)}><ShoppingCart /> Buy</Button>
                ) : (
                  <Button size="sm" variant="outline" asChild><Link href="/login?callbackUrl=/marketplace">Sign in to buy</Link></Button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {data && data.pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft /> Prev</Button>
          <span className="text-sm tabular text-muted-foreground">Page {data.page} of {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight /></Button>
        </nav>
      )}
      <BuyDialog listing={buying} onOpenChange={(o) => !o && setBuying(null)} />
    </div>
  );
}

function MyListings() {
  const { cancel } = useCardActions();
  const { data, isLoading } = useQuery({
    queryKey: ["my-listings"],
    queryFn: () => api<{ active: ListingView[]; recent: ListingView[] }>("/api/marketplace/mine"),
  });
  if (isLoading || !data) return <div className="flex h-40 items-center justify-center"><LoaderCircle className="animate-spin text-muted-foreground" /></div>;
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display font-semibold">Active ({data.active.length})</h2>
        {data.active.length === 0 ? (
          <EmptyState title="Nothing listed" description="Use “Sell a card” to list one of your cards for other collectors." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {data.active.map((l) => (
              <div key={l.id} className="space-y-2 rounded-2xl border bg-card/70 p-2.5">
                <PokeCard card={l.card} sizes="200px" />
                <p className="truncate text-sm font-semibold">{l.card.name}</p>
                <div className="flex items-center justify-between">
                  <RC amount={l.price} compact className="text-amber-200" />
                  <span className="text-[11px] text-muted-foreground">{timeAgo(l.createdAt)}</span>
                </div>
                <Button size="sm" variant="outline" className="w-full" disabled={cancel.isPending} onClick={() => cancel.mutate(l.id)}>
                  <Undo2 /> Cancel listing
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-display font-semibold">Recently sold or cancelled</h2>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="max-w-56 truncate font-medium">{l.card.name}</TableCell>
                  <TableCell className="text-right"><RC amount={l.price} /></TableCell>
                  <TableCell>{l.status === "SOLD" ? <Badge variant="success">Sold</Badge> : <Badge variant="secondary">Cancelled</Badge>}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{timeAgo(l.soldAt ?? l.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function SaleHistory() {
  const user = useUser();
  const [mine, setMine] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["sales", mine],
    queryFn: () => api<{ items: Sale[] }>(`/api/marketplace/history?limit=60${mine ? "&mine=1" : ""}`),
    refetchInterval: 30_000,
  });
  return (
    <div className="space-y-3">
      {user && (
        <div className="flex gap-1" role="group" aria-label="History scope">
          {[false, true].map((m) => (
            <Button key={String(m)} size="sm" variant={mine === m ? "secondary" : "ghost"} onClick={() => setMine(m)} aria-pressed={mine === m}>
              {m ? "My trades" : "All sales"}
            </Button>
          ))}
        </div>
      )}
      {isLoading || !data ? (
        <div className="flex h-40 items-center justify-center"><LoaderCircle className="animate-spin text-muted-foreground" /></div>
      ) : data.items.length === 0 ? (
        <EmptyState title="No sales yet" />
      ) : (
        <div className="rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead className="hidden sm:table-cell">Rarity</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="hidden md:table-cell">Seller → Buyer</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-56">
                    <Link href={`/collection/${s.card.id}`} className="block truncate font-medium hover:underline">{s.card.name}</Link>
                    <span className="text-[11px] text-muted-foreground">{s.card.set.name}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell"><RarityBadge rarity={s.card.rarity} short /></TableCell>
                  <TableCell className="text-right">
                    <RC amount={s.price} />
                    {s.viewerRole && (
                      <span className={cn("block text-[11px]", s.viewerRole === "buyer" ? "text-rose-300" : "text-emerald-300")}>{s.viewerRole === "buyer" ? "You bought" : "You sold"}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{s.seller.username} → {s.buyer.username}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{timeAgo(s.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

type IndexSort = "value" | "d1" | "d7" | "d30" | "volume";

function PriceIndex() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<IndexSort>("value");
  const [dir, setDir] = useState<1 | -1>(-1);
  const { data, isLoading } = useQuery({
    queryKey: ["market-index"],
    queryFn: () => api<{ items: { card: CardView; change: PriceChanges | null }[] }>("/api/market"),
    staleTime: 60_000,
  });
  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.toLowerCase();
    const val = (r: (typeof data.items)[number]) =>
      sort === "value" ? r.card.currentValue : sort === "volume" ? (r.change?.volume7d ?? 0) : (r.change?.[sort] ?? -Infinity);
    return data.items.filter((r) => !needle || `${r.card.name} ${r.card.set.name}`.toLowerCase().includes(needle)).sort((a, b) => (val(a) - val(b)) * dir);
  }, [data, q, sort, dir]);
  const header = (key: IndexSort, label: string, className?: string) => (
    <TableHead className={cn("text-right", className)}>
      <button
        className={cn("inline-flex items-center gap-1 uppercase", sort === key && "text-foreground")}
        onClick={() => (sort === key ? setDir((d) => (d === 1 ? -1 : 1)) : (setSort(key), setDir(-1)))}
        aria-label={`Sort by ${label}`}
      >
        {label} {sort === key ? (dir === -1 ? "↓" : "↑") : ""}
      </button>
    </TableHead>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter cards…" className="sm:max-w-xs" aria-label="Filter price index" />
        <p className="text-xs text-muted-foreground">Fictional simulated values — updated by the scheduled market simulation.</p>
      </div>
      {isLoading || !data ? (
        <div className="flex h-40 items-center justify-center"><LoaderCircle className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-2xl border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Card</TableHead>
                {header("value", "Value")}
                {header("d1", "24h")}
                {header("d7", "7d", "hidden sm:table-cell")}
                {header("d30", "30d", "hidden md:table-cell")}
                {header("volume", "Vol 7d", "hidden lg:table-cell")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ card, change }) => (
                <TableRow key={card.id}>
                  <TableCell className="max-w-64">
                    <Link href={`/collection/${card.id}`} className="flex items-center gap-2 hover:underline">
                      <span className="w-7 shrink-0"><PokeCard card={card} sizes="28px" holo={false} /></span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{card.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{card.variant ? `${card.variant} · ` : ""}{card.set.name}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right"><RC amount={card.currentValue} compact /></TableCell>
                  <ChangeCell value={change?.d1} />
                  <ChangeCell value={change?.d7} className="hidden sm:table-cell" />
                  <ChangeCell value={change?.d30} className="hidden md:table-cell" />
                  <TableCell className="hidden text-right tabular text-muted-foreground lg:table-cell">{change?.volume7d.toLocaleString() ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ChangeCell({ value, className }: { value: number | null | undefined; className?: string }) {
  const up = (value ?? 0) > 0;
  const down = (value ?? 0) < 0;
  return (
    <TableCell className={cn("text-right tabular", up && "text-emerald-300", down && "text-rose-300", className)}>
      <span className="inline-flex items-center gap-0.5">
        {up ? <ArrowUpRight className="size-3.5" /> : down ? <ArrowDownRight className="size-3.5" /> : null}
        {formatPercentChange(value)}
      </span>
    </TableCell>
  );
}
