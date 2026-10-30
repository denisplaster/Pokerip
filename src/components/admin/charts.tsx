"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatNumber } from "@/lib/format";

const axisTick = { fill: "var(--viz-axis)", fontSize: 11 };

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  format?: (v: number) => string;
}

function TooltipCard({ active, payload, label, series, labelFormat }: TooltipContentProps<ValueType, NameType> & { series: SeriesDef[]; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 text-muted-foreground">{labelFormat ? labelFormat(String(label)) : String(label)}</p>
      {series.map((s) => {
        const entry = payload.find((p) => p.dataKey === s.key);
        if (!entry) return null;
        const v = Number(entry.value);
        return (
          <p key={s.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold tabular text-foreground">{s.format ? s.format(v) : v.toLocaleString()}</span>
          </p>
        );
      })}
    </div>
  );
}

export function Legend({ series, shape = "line" }: { series: SeriesDef[]; shape?: "line" | "rect" }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className={shape === "line" ? "inline-block h-0.5 w-4 rounded-full" : "inline-block size-2.5 rounded-[3px]"} style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function TimeLineChart({ data, x, series, height = 240, labelFormat }: { data: Record<string, unknown>[]; x: string; series: SeriesDef[]; height?: number; labelFormat?: (l: string) => string }) {
  return (
    <div className="space-y-2">
      <Legend series={series} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey={x} tick={axisTick} axisLine={false} tickLine={false} minTickGap={28} tickFormatter={labelFormat} />
            <YAxis width={48} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatNumber(v, { compact: true })} />
            <Tooltip cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }} content={(props) => <TooltipCard {...props} series={series} labelFormat={labelFormat} />} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, fill: s.color, stroke: "var(--viz-surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ColumnChart({
  data,
  x,
  series,
  height = 240,
  labelFormat,
  yFormat,
}: {
  data: Record<string, unknown>[];
  x: string;
  series: SeriesDef[];
  height?: number;
  labelFormat?: (l: string) => string;
  yFormat?: (v: number) => string;
}) {
  return (
    <div className="space-y-2">
      <Legend series={series} shape="rect" />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey={x} tick={axisTick} axisLine={false} tickLine={false} minTickGap={8} tickFormatter={labelFormat} />
            <YAxis width={48} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={yFormat ?? ((v: number) => formatNumber(v, { compact: true }))} />
            <Tooltip cursor={{ fill: "oklch(1 0 0 / 4%)" }} content={(props) => <TooltipCard {...props} series={series} labelFormat={labelFormat} />} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} fill={s.color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
