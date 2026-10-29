"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, Dices, Fingerprint, LoaderCircle, Plus, Search, Trash, TriangleAlert, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useState } from "react";
import { toast } from "sonner";
import { RC } from "@/components/common/coin-icon";
import { PokeCard } from "@/components/cards/poke-card";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { formatDate, formatProbability } from "@/lib/format";
import { PPM } from "@/lib/probability";
import { RARITIES, RARITY_META, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { CardView } from "@/server/services/cards";
import type { PackAdmin } from "@/server/services/admin";
import { Panel } from "./admin-ui";
import { PackDetailsForm, type PackDetails } from "./pack-details-form";

interface PoolEntry {
  cardId: string;
  weight: number;
  card: CardView;
}

/** Default within-tier weight: pricier cards are proportionally rarer. */
function defaultWeight(value: number) {
  return Math.max(1, Math.round(1_000_000 / Math.pow(value, 0.85)));
}

export function PackEditor({ pack }: { pack: PackAdmin }) {
  const router = useRouter();
  const [percent, setPercent] = useState<Record<RarityKey, string>>(
    () => Object.fromEntries(pack.odds.map((o) => [o.rarity, String(o.weightPpm / 10_000)])) as Record<RarityKey, string>,
  );
  const [pool, setPool] = useState<PoolEntry[]>(pack.pool);
  const [search, setSearch] = useState("");
  const dsearch = useDeferredValue(search);

  const odds = RARITIES.map((r) => ({ rarity: r, weightPpm: Math.round(Number(percent[r] || 0) * 10_000) }));
  const sum = odds.reduce((s, o) => s + o.weightPpm, 0);
  // Serialised so it can be compared cheaply and debounced for the live preview.
  const payloadJson = JSON.stringify({ odds, pool: pool.map((p) => ({ cardId: p.cardId, weight: p.weight })) });
  const [debounced, setDebounced] = useState(payloadJson);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(payloadJson), 400);
    return () => clearTimeout(t);
  }, [payloadJson]);
  const preview = useQuery({
    queryKey: ["pack-preview", pack.id, debounced],
    queryFn: () => api<{ problems: string[]; expectedValue: number | null; rtp: number | null }>(`/api/admin/packs/${pack.id}/preview`, { body: JSON.parse(debounced) }),
  });
  const results = useQuery({
    queryKey: ["admin-card-search", dsearch],
    queryFn: () => api<{ items: (CardView & { isActive: boolean })[] }>(`/api/admin/cards?limit=12&q=${encodeURIComponent(dsearch)}`),
    enabled: dsearch.trim().length >= 2,
  });

  const saveDetails = useMutation({
    mutationFn: (v: PackDetails) => api(`/api/admin/packs/${pack.id}`, { method: "PATCH", body: v }),
    onSuccess: () => {
      toast.success("Pack details saved");
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveOdds = useMutation({
    mutationFn: () => api<{ version: number; hash: string }>(`/api/admin/packs/${pack.id}/odds`, { method: "PUT", body: JSON.parse(payloadJson) }),
    onSuccess: (r) => {
      toast.success(`Published odds version ${r.version}`, { description: `SHA-256 ${r.hash.slice(0, 16)}…` });
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tierWeight = (r: RarityKey) => pool.filter((p) => p.card.rarity === r).reduce((s, p) => s + p.weight, 0);
  const inPool = new Set(pool.map((p) => p.cardId));

  return (
    <div className="space-y-6">
      <Panel title="Details">
        <PackDetailsForm
          initial={{ name: pack.name, slug: pack.slug, tagline: pack.tagline, description: pack.description, price: pack.price, cardsPerPack: pack.cardsPerPack, theme: pack.theme, isActive: pack.isActive, featured: pack.featured, sortOrder: pack.sortOrder }}
          onSubmit={(v) => saveDetails.mutate(v)}
          pending={saveDetails.isPending}
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Panel title="Rarity probabilities" description="Per card slot. Must total exactly 100%.">
            <div className="space-y-2">
              {RARITIES.map((r) => (
                <div key={r} className="grid grid-cols-[110px_1fr_auto] items-center gap-2">
                  <RarityBadge rarity={r} />
                  <Input
                    type="number"
                    step="0.0001"
                    min={0}
                    max={100}
                    value={percent[r]}
                    onChange={(e) => setPercent((p) => ({ ...p, [r]: e.target.value }))}
                    aria-label={`${RARITY_META[r].label} percent`}
                    className="h-8"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              ))}
            </div>
            <p className={cn("mt-3 flex items-center gap-1.5 text-sm font-semibold tabular", sum === PPM ? "text-emerald-300" : "text-amber-300")}>
              {sum === PPM ? <CircleCheck className="size-4" /> : <TriangleAlert className="size-4" />} Total {(sum / 10_000).toFixed(4)}%
            </p>
          </Panel>

          <Panel title="Preview">
            {preview.isFetching && !preview.data ? (
              <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
            ) : preview.data?.problems.length ? (
              <ul className="space-y-1 text-xs text-amber-200">
                {preview.data.problems.map((p) => (
                  <li key={p} className="flex gap-1.5"><TriangleAlert className="mt-px size-3.5 shrink-0" /> {p}</li>
                ))}
              </ul>
            ) : preview.data ? (
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Expected value</dt><dd><RC amount={Math.round(preview.data.expectedValue ?? 0)} /></dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Price</dt><dd><RC amount={pack.price} /></dd></div>
                <div className="flex justify-between font-semibold"><dt>Return to player</dt><dd className="tabular">{((preview.data.rtp ?? 0) * 100).toFixed(1)}%</dd></div>
              </dl>
            ) : null}
            <Button className="mt-4 w-full" onClick={() => saveOdds.mutate()} disabled={saveOdds.isPending || sum !== PPM || Boolean(preview.data?.problems.length)}>
              {saveOdds.isPending ? <LoaderCircle className="animate-spin" /> : <Upload />} Publish new odds version
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">Publishing applies to all future openings immediately and is recorded in the audit log and the public odds history.</p>
            <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
              <Link href={`/admin/simulator?pack=${pack.id}`}><Dices /> Simulate published odds</Link>
            </Button>
          </Panel>

          <Panel title="Odds history">
            <ul className="space-y-1.5 text-xs">
              {pack.oddsVersions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5"><Fingerprint className="size-3.5 text-muted-foreground" /> v{v.version} · {formatDate(v.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
                  <code className="font-mono text-[10px] text-muted-foreground" title={v.hash}>{v.hash.slice(0, 10)}</code>
                </li>
              ))}
              {pack.oddsVersions.length === 0 && <li className="text-muted-foreground">No published versions yet.</li>}
            </ul>
          </Panel>
        </div>

        <Panel title={`Drop pool (${pool.length} cards)`} description="Within a tier, each card is chosen in proportion to its weight. The resulting per-slot probability is shown for each card.">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Add cards — search the catalog…" className="pl-9" aria-label="Search cards to add" />
            {dsearch.trim().length >= 2 && results.data && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1 shadow-2xl">
                {results.data.items.filter((c) => c.isActive).map((c) => (
                  <li key={c.id}>
                    <button
                      disabled={inPool.has(c.id)}
                      onClick={() => {
                        setPool((p) => [...p, { cardId: c.id, weight: defaultWeight(c.currentValue), card: c }]);
                        setSearch("");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/[0.06] disabled:opacity-40"
                    >
                      <span className="w-6"><PokeCard card={c} sizes="24px" holo={false} /></span>
                      <span className="min-w-0 flex-1 truncate">{c.name} <span className="text-xs text-muted-foreground">· {c.set.name} {c.number}</span></span>
                      <RarityBadge rarity={c.rarity} short />
                      {inPool.has(c.id) ? <span className="text-[11px] text-muted-foreground">In pool</span> : <Plus className="size-4" />}
                    </button>
                  </li>
                ))}
                {results.data.items.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">No cards found.</li>}
              </ul>
            )}
          </div>
          <div className="space-y-5">
            {[...RARITIES].reverse().map((r) => {
              const entries = pool.filter((p) => p.card.rarity === r).sort((a, b) => b.card.currentValue - a.card.currentValue);
              const tw = tierWeight(r);
              const tierPpm = odds.find((o) => o.rarity === r)!.weightPpm;
              if (!entries.length && tierPpm === 0) return null;
              return (
                <div key={r}>
                  <div className="mb-2 flex items-center gap-2">
                    <RarityBadge rarity={r} />
                    <span className="text-xs text-muted-foreground">{entries.length} cards · tier {formatProbability(tierPpm / PPM)}</span>
                    {tierPpm > 0 && entries.length === 0 && <span className="text-xs text-amber-300">needs at least one card</span>}
                  </div>
                  <ul className="divide-y rounded-xl border">
                    {entries.map((e) => (
                      <li key={e.cardId} className="grid grid-cols-[28px_1fr_auto_88px_auto] items-center gap-2 px-2 py-1.5 text-sm sm:grid-cols-[28px_1fr_80px_auto_88px_auto]">
                        <PokeCard card={e.card} sizes="28px" holo={false} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{e.card.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{e.card.variant ? `${e.card.variant} · ` : ""}{e.card.set.name}</span>
                        </span>
                        <RC amount={e.card.currentValue} compact className="hidden text-xs sm:inline-flex" />
                        <span className="w-16 text-right text-[11px] tabular text-cyan-200">{tw ? formatProbability((tierPpm / PPM) * (e.weight / tw)) : "—"}</span>
                        <Input
                          type="number"
                          min={1}
                          value={e.weight}
                          onChange={(ev) => {
                            const w = Math.max(1, Math.floor(Number(ev.target.value) || 1));
                            setPool((p) => p.map((x) => (x.cardId === e.cardId ? { ...x, weight: w } : x)));
                          }}
                          className="h-7 px-2 text-xs"
                          aria-label={`Weight for ${e.card.name}`}
                        />
                        <Button variant="ghost" size="icon-sm" onClick={() => setPool((p) => p.filter((x) => x.cardId !== e.cardId))} aria-label={`Remove ${e.card.name}`}>
                          <Trash className="text-muted-foreground" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
