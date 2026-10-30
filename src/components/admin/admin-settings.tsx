"use client";

import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Save, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { RARITIES, RARITY_META, type RarityKey } from "@/lib/rarity";
import type { SystemSettings } from "@/server/services/settings";
import { Panel } from "./admin-ui";

interface AuditRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: unknown;
  createdAt: string;
  admin: { username: string };
}

function NumberField({ label, value, onChange, step = 1, hint }: { label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AdminSettings({ initial, audit, lastTick }: { initial: SystemSettings; audit: AuditRow[]; lastTick: string | null }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const save = useMutation({
    mutationFn: () => api("/api/admin/settings", { method: "PUT", body: s }),
    onSuccess: () => {
      toast.success("Settings saved");
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const tick = useMutation({
    mutationFn: () => api<{ changed: number; cards: number }>("/api/admin/market-tick", { method: "POST", body: {} }),
    onSuccess: (r) => {
      toast.success(`Market tick: ${r.changed} of ${r.cards} card values moved`);
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const e = s.economy;
  const m = s.market;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Economy">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Instant-sell rate (%)" value={e.instantSellBps / 100} step={0.5} onChange={(v) => setS({ ...s, economy: { ...e, instantSellBps: Math.round(v * 100) } })} hint="Share of virtual value paid when selling to the platform." />
            <NumberField label="Marketplace fee (%)" value={e.marketplaceFeeBps / 100} step={0.5} onChange={(v) => setS({ ...s, economy: { ...e, marketplaceFeeBps: Math.round(v * 100) } })} hint="Kept from each marketplace sale (a coin sink)." />
            <NumberField label="Level-up base reward (RC)" value={e.levelUpBaseReward} onChange={(v) => setS({ ...s, economy: { ...e, levelUpBaseReward: Math.max(0, Math.floor(v)) } })} />
            <NumberField label="Level-up reward per level (RC)" value={e.levelUpPerLevel} onChange={(v) => setS({ ...s, economy: { ...e, levelUpPerLevel: Math.max(0, Math.floor(v)) } })} />
          </div>
        </Panel>
        <Panel title="Activity feed">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Minimum rarity for big pulls</Label>
              <Select value={s.activity.bigPullMinRarity} onValueChange={(v) => setS({ ...s, activity: { ...s.activity, bigPullMinRarity: v as RarityKey } })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{RARITIES.map((r) => <SelectItem key={r} value={r}>{RARITY_META[r].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <NumberField label="Minimum value for big pulls (RC)" value={s.activity.bigPullMinValue} onChange={(v) => setS({ ...s, activity: { ...s.activity, bigPullMinValue: Math.max(0, Math.floor(v)) } })} hint="Chase cards always qualify." />
          </div>
        </Panel>
      </div>
      <Panel
        title="Simulated market"
        description={`Mean-reverting random walk around each card's base value. Last tick: ${lastTick ? formatDate(lastTick, { dateStyle: "medium", timeStyle: "short" }) : "never"}.`}
        actions={
          <Button variant="outline" size="sm" onClick={() => tick.mutate()} disabled={tick.isPending}>
            {tick.isPending ? <LoaderCircle className="animate-spin" /> : <TrendingUp />} Run market tick now
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Mean reversion (per day)" value={m.meanReversion} step={0.01} onChange={(v) => setS({ ...s, market: { ...m, meanReversion: v } })} />
          <NumberField label="Max change per tick (%)" value={Math.round(m.maxTickChange * 1000) / 10} step={0.5} onChange={(v) => setS({ ...s, market: { ...m, maxTickChange: v / 100 } })} />
          <NumberField label="Floor (× base)" value={m.floorFactor} step={0.05} onChange={(v) => setS({ ...s, market: { ...m, floorFactor: v } })} />
          <NumberField label="Ceiling (× base)" value={m.ceilingFactor} step={0.1} onChange={(v) => setS({ ...s, market: { ...m, ceilingFactor: v } })} />
          {RARITIES.map((r) => (
            <NumberField
              key={r}
              label={`${RARITY_META[r].label} volatility (%/day)`}
              value={Math.round(m.volatility[r] * 1000) / 10}
              step={0.5}
              onChange={(v) => setS({ ...s, market: { ...m, volatility: { ...m.volatility, [r]: v / 100 } } })}
            />
          ))}
        </div>
      </Panel>
      <Button size="lg" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Save settings
      </Button>
      <Panel title="Audit log" description="Most recent administrator actions.">
        <div className="max-h-[480px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="hidden md:table-cell">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(a.createdAt, { dateStyle: "short", timeStyle: "short" })}</TableCell>
                  <TableCell className="text-sm">{a.admin.username}</TableCell>
                  <TableCell className="text-xs"><code>{a.action}</code><span className="block text-[10px] text-muted-foreground">{a.targetType}</span></TableCell>
                  <TableCell className="hidden max-w-md truncate font-mono text-[10px] text-muted-foreground md:table-cell" title={JSON.stringify(a.details)}>{JSON.stringify(a.details)}</TableCell>
                </TableRow>
              ))}
              {audit.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No admin actions yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}
