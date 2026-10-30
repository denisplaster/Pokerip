"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PricePoint {
  t: string;
  price: number;
  volume: number;
}

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
] as const;

function ChartTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as PricePoint;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="text-sm font-bold tabular text-foreground">{p.price.toLocaleString()} RC</p>
      <p className="text-muted-foreground">{formatDate(p.t, { dateStyle: "medium" })}</p>
      <p className="mt-1 text-muted-foreground tabular">Mock volume {p.volume.toLocaleString()}</p>
    </div>
  );
}

/** Fictional virtual price history with a crosshair tooltip. */
export function PriceChart({ history, height = 220 }: { history: PricePoint[]; height?: number }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30d");
  const days = RANGES.find((r) => r.key === range)!.days;
  // Anchor the window to the latest data point so rendering stays pure.
  const latest = history.length ? new Date(history[history.length - 1].t).getTime() : 0;
  const cutoff = latest - days * 86_400_000;
  const data = history.filter((h) => new Date(h.t).getTime() >= cutoff);
  const first = data[0]?.price ?? 0;
  const last = data[data.length - 1]?.price ?? 0;
  const change = first ? (last - first) / first : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={cn("rounded-md px-2.5 py-1 text-xs font-semibold transition-colors", range === r.key ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className={cn("text-xs font-semibold tabular", change > 0 ? "text-emerald-300" : change < 0 ? "text-rose-300" : "text-muted-foreground")}>
          {change > 0 ? "▲" : change < 0 ? "▼" : "•"} {(change * 100).toFixed(1)}% over {days} days
        </span>
      </div>
      {data.length < 2 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Not enough price history yet.</p>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="price-wash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--viz-accent)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--viz-accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
              <XAxis
                dataKey="t"
                tickFormatter={(t: string) => formatDate(t, { month: "short", day: "numeric" })}
                tick={{ fill: "var(--viz-axis)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={36}
              />
              <YAxis
                width={52}
                tickFormatter={(v: number) => formatNumber(v, { compact: true })}
                tick={{ fill: "var(--viz-axis)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip content={ChartTooltip} cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="price"
                stroke="var(--viz-accent)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="url(#price-wash)"
                activeDot={{ r: 5, fill: "var(--viz-accent)", stroke: "var(--viz-surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Fictional values from RipVault&apos;s simulated market — not real market prices.</p>
    </div>
  );
}
