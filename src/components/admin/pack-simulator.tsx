"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleCheck, Dices, LoaderCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RC } from "@/components/common/coin-icon";
import { PokeCard } from "@/components/cards/poke-card";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { formatProbability } from "@/lib/format";
import { RARITY_META } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { SimulationReport } from "@/server/services/admin";
import { Kpi, Panel } from "./admin-ui";
import { ColumnChart } from "./charts";

const pct = (v: number) => formatProbability(v);

export function PackSimulator({ packs, initialPack }: { packs: { id: string; name: string }[]; initialPack?: string }) {
  const [packId, setPackId] = useState(initialPack ?? packs[0]?.id ?? "");
  const [n, setN] = useState<1000 | 10000 | 100000>(10000);
  const run = useMutation({
    mutationFn: () => api<SimulationReport>("/api/admin/simulate", { body: { packId, packs: n } }),
    onError: (e: Error) => toast.error(e.message),
  });
  const r = run.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Pack</Label>
          <Select value={packId} onValueChange={setPackId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{packs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Simulated openings</Label>
          <div className="flex rounded-xl border p-1">
            {([1000, 10000, 100000] as const).map((v) => (
              <button key={v} onClick={() => setN(v)} aria-pressed={n === v} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", n === v ? "bg-white/10" : "text-muted-foreground")}>
                {v.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={() => run.mutate()} disabled={!packId || run.isPending}>
          {run.isPending ? <LoaderCircle className="animate-spin" /> : <Dices />} Run simulation
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Uses the pack&apos;s published odds and the production CSPRNG. Nothing is written to the database.</p>

      {r && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Packs / cards" value={`${r.packs.toLocaleString()} / ${r.cards.toLocaleString()}`} hint={`odds v${r.oddsVersion} · ${r.elapsedMs} ms`} />
            <Kpi label="Avg pack value" value={<RC amount={Math.round(r.averageValue)} />} hint={`Expected ${Math.round(r.expectedValue).toLocaleString()} RC`} />
            <Kpi label="Simulated RTP" value={`${(r.rtp * 100).toFixed(1)}%`} hint={`Price ${r.pack.price.toLocaleString()} RC`} />
            <Kpi label="Median / p90" value={<span className="text-lg">{r.medianValue.toLocaleString()} / {r.p90Value.toLocaleString()}</span>} hint="Pack value (RC)" />
            <Kpi label="p99 / max" value={<span className="text-lg">{r.p99Value.toLocaleString()} / {r.maxValue.toLocaleString()}</span>} hint="Pack value (RC)" />
            <Kpi
              label="Chi-square fit"
              value={
                <span className={cn("flex items-center gap-1.5 text-lg", r.chiSquare.pValue > 0.001 ? "text-emerald-300" : "text-amber-300")}>
                  {r.chiSquare.pValue > 0.001 ? <CircleCheck className="size-4" /> : <TriangleAlert className="size-4" />} p = {r.chiSquare.pValue.toPrecision(3)}
                </span>
              }
              hint={`χ² = ${r.chiSquare.statistic.toFixed(2)}, df = ${r.chiSquare.df}`}
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Rarity distribution" description="Observed share of simulated cards vs the published odds.">
              <ColumnChart
                data={r.rarity.filter((x) => x.expectedShare > 0).map((x) => ({ ...x, label: RARITY_META[x.rarity].label }))}
                x="label"
                yFormat={(v) => `${Math.round(v * 100)}%`}
                series={[
                  { key: "observedShare", label: "Observed", color: "var(--series-1)", format: pct },
                  { key: "expectedShare", label: "Published", color: "var(--series-2)", format: pct },
                ]}
              />
              <Table className="mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Rarity</TableHead>
                    <TableHead className="text-right">Observed</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    <TableHead className="text-right">Published</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.rarity.filter((x) => x.expectedShare > 0).map((x) => (
                    <TableRow key={x.rarity}>
                      <TableCell><RarityBadge rarity={x.rarity} /></TableCell>
                      <TableCell className="text-right tabular">{x.observed.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">{Math.round(x.expected).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular">{pct(x.observedShare)}</TableCell>
                      <TableCell className="text-right tabular text-muted-foreground">{pct(x.expectedShare)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
            <Panel title="Pack value distribution" description="Number of simulated packs per value band (log-scaled bands, RC).">
              <ColumnChart data={r.histogram} x="label" series={[{ key: "count", label: "Packs", color: "var(--viz-accent)" }]} height={260} />
            </Panel>
          </div>
          <Panel title="Most valuable cards hit" description="Observed hits vs expected hits for the pool's top cards.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {r.topCards.map((t) => (
                <div key={t.card.id} className="space-y-1 text-xs">
                  <PokeCard card={t.card} sizes="140px" />
                  <p className="truncate font-semibold">{t.card.name}</p>
                  <p className="tabular text-muted-foreground">{t.count} hits · exp. {t.expected.toFixed(1)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
