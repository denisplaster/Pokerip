"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { RC } from "@/components/common/coin-icon";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { formatDate, formatNumber } from "@/lib/format";
import { RARITY_META } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { AdminStats } from "@/server/services/admin";
import { Kpi, Panel } from "./admin-ui";
import { ColumnChart, TimeLineChart } from "./charts";

const RANGES = [7, 30, 90] as const;
const day = (d: string) => formatDate(`${d}T00:00:00Z`, { month: "short", day: "numeric", timeZone: "UTC" });
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Admin analytics with a date-range filter that scopes every chart and table. */
export function AdminOverview({ initial }: { initial: AdminStats }) {
  return <RangeWrapper initial={initial} />;
}

function RangeWrapper({ initial }: { initial: AdminStats }) {
  const [days, setDays] = useState<number>(initial.days);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-stats", days],
    queryFn: () => api<AdminStats>(`/api/admin/stats?days=${days}`),
    initialData: days === initial.days ? initial : undefined,
    placeholderData: keepPreviousData,
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border p-1" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              aria-pressed={days === r}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", days === r ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Last {r} days
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={cn(isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>
      {data && <OverviewBody data={data} fetching={isFetching} />}
    </div>
  );
}

function OverviewBody({ data, fetching }: { data: AdminStats; fetching: boolean }) {
  const k = data.kpis;
  return (
    <div className={cn("space-y-6 transition-opacity", fetching && "opacity-60")}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Players" value={formatNumber(k.users)} hint={`+${k.newUsers7d} in 7 days`} />
        <Kpi label="Active (24h / 7d)" value={`${k.activeUsers24h} / ${k.activeUsers7d}`} hint="Users who opened packs" />
        <Kpi label="RC in circulation" value={<RC amount={k.circulation} compact />} hint="Sum of all wallets" />
        <Kpi label="Packs opened" value={formatNumber(k.packsOpened, { compact: true })} hint={`${k.packsOpened24h} in 24h`} />
        <Kpi label="Marketplace (7d)" value={<RC amount={k.marketVolume7d} compact />} hint={`${k.marketSales7d} sales · ${k.activeListings} listed`} />
        <Kpi label="Realised pack RTP" value={k.realizedRtp === null ? "—" : pct(k.realizedRtp)} hint={`Pull value ÷ RC spent, ${data.days}d`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Pack openings per day" description={`Last ${data.days} days (UTC)`}>
          <ColumnChart data={data.daily} x="day" labelFormat={day} series={[{ key: "openings", label: "Openings", color: "var(--viz-accent)" }]} />
        </Panel>
        <Panel title="Currency issued vs spent" description="Platform-issued RC (rewards, sales, grants) vs RC removed by packs and boxes. Marketplace transfers between players excluded.">
          <TimeLineChart
            data={data.daily}
            x="day"
            labelFormat={day}
            series={[
              { key: "issued", label: "Issued", color: "var(--series-1)", format: (v) => `${v.toLocaleString()} RC` },
              { key: "spent", label: "Spent", color: "var(--series-2)", format: (v) => `${v.toLocaleString()} RC` },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Pulled rarity mix vs published odds" description="Share of all pulled cards, compared with the share expected from the packs that were opened.">
          <ColumnChart
            data={data.rarity.map((r) => ({ ...r, label: RARITY_META[r.rarity].label }))}
            x="label"
            yFormat={(v) => `${Math.round(v * 100)}%`}
            series={[
              { key: "observedShare", label: "Observed", color: "var(--series-1)", format: pct },
              { key: "expectedShare", label: "Expected", color: "var(--series-2)", format: pct },
            ]}
          />
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Rarity</TableHead>
                <TableHead className="text-right">Pulled</TableHead>
                <TableHead className="text-right">Observed</TableHead>
                <TableHead className="text-right">Expected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rarity.map((r) => (
                <TableRow key={r.rarity}>
                  <TableCell><RarityBadge rarity={r.rarity} /></TableCell>
                  <TableCell className="text-right tabular">{r.observed.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular">{pct(r.observedShare)}</TableCell>
                  <TableCell className="text-right tabular text-muted-foreground">{pct(r.expectedShare)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <div className="space-y-4">
          <Panel title="Packs" description={`Openings and RC flow, last ${data.days} days`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pack</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">RTP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.packs.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right tabular">{p.openings.toLocaleString()}</TableCell>
                    <TableCell className="text-right"><RC amount={p.spent} compact /></TableCell>
                    <TableCell className="text-right tabular">{p.spent ? pct(p.value / p.spent) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <Panel title="Ledger by type" description={`Net RC per transaction type, last ${data.days} days`}>
            <Table>
              <TableBody>
                {data.byType.map((t) => (
                  <TableRow key={t.type}>
                    <TableCell className="text-xs">{t.type.replaceAll("_", " ").toLowerCase()}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular">{t.count.toLocaleString()} tx</TableCell>
                    <TableCell className={cn("text-right text-sm font-semibold tabular", t.total >= 0 ? "text-emerald-300" : "text-rose-300")}>
                      {t.total > 0 ? "+" : ""}
                      {t.total.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-[11px] text-muted-foreground">Marketplace fees collected: {k.marketplaceFees.toLocaleString()} RC</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
