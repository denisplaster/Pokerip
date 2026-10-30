"use client";

import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { Panel } from "./admin-ui";

interface Day {
  day: number;
  coins: number;
  xp: number;
  packId: string | null;
  label: string;
}

interface Mission {
  id: string;
  key: string;
  title: string;
  description: string;
  type: string;
  period: string;
  target: number;
  rewardCoins: number;
  rewardXp: number;
  isActive: boolean;
}

export function AdminRewards({ days: initialDays, missions, packs }: { days: Day[]; missions: Mission[]; packs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays);
  const setDay = (d: number, patch: Partial<Day>) => setDays((all) => all.map((x) => (x.day === d ? { ...x, ...patch } : x)));
  const saveDays = useMutation({
    mutationFn: () => api("/api/admin/daily-rewards", { method: "PUT", body: { days } }),
    onSuccess: () => {
      toast.success("Daily rewards saved");
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-6">
      <Panel title="Daily login calendar" description="Seven-day cycle. Each day can grant coins, XP and optionally a free pack voucher.">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Coins</TableHead>
                <TableHead>XP</TableHead>
                <TableHead>Free pack</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((d) => (
                <TableRow key={d.day}>
                  <TableCell className="font-semibold">{d.day}</TableCell>
                  <TableCell><Input value={d.label} onChange={(e) => setDay(d.day, { label: e.target.value })} className="h-8 w-44" aria-label={`Day ${d.day} label`} /></TableCell>
                  <TableCell><Input type="number" min={0} value={d.coins} onChange={(e) => setDay(d.day, { coins: Math.max(0, Math.floor(Number(e.target.value))) })} className="h-8 w-28" aria-label={`Day ${d.day} coins`} /></TableCell>
                  <TableCell><Input type="number" min={0} value={d.xp} onChange={(e) => setDay(d.day, { xp: Math.max(0, Math.floor(Number(e.target.value))) })} className="h-8 w-24" aria-label={`Day ${d.day} XP`} /></TableCell>
                  <TableCell>
                    <Select value={d.packId ?? "none"} onValueChange={(v) => setDay(d.day, { packId: v === "none" ? null : v })}>
                      <SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {packs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button className="mt-4" onClick={() => saveDays.mutate()} disabled={saveDays.isPending}>
          {saveDays.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Save calendar
        </Button>
      </Panel>
      <Panel title="Missions" description="Targets and rewards. Mission types are tracked automatically by the game services.">
        <div className="space-y-3">
          {missions.map((m) => <MissionRow key={m.id} mission={m} />)}
        </div>
      </Panel>
    </div>
  );
}

function MissionRow({ mission }: { mission: Mission }) {
  const [m, setM] = useState(mission);
  const save = useMutation({
    mutationFn: () => api(`/api/admin/missions/${m.id}`, { method: "PATCH", body: { title: m.title, description: m.description, target: m.target, rewardCoins: m.rewardCoins, rewardXp: m.rewardXp, isActive: m.isActive } }),
    onSuccess: () => toast.success(`Saved “${m.title}”`),
    onError: (e: Error) => toast.error(e.message),
  });
  const dirty = JSON.stringify(m) !== JSON.stringify(mission);
  return (
    <div className="grid items-center gap-2 rounded-xl border p-3 lg:grid-cols-[1.2fr_1.6fr_90px_100px_80px_auto_auto]">
      <div className="space-y-1">
        <Input value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} className="h-8" aria-label="Title" />
        <div className="flex gap-1"><Badge variant="outline" className="text-[10px]">{m.period.toLowerCase()}</Badge><Badge variant="secondary" className="text-[10px]">{m.type.replaceAll("_", " ").toLowerCase()}</Badge></div>
      </div>
      <Input value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} className="h-8" aria-label="Description" />
      <Input type="number" min={1} value={m.target} onChange={(e) => setM({ ...m, target: Math.max(1, Math.floor(Number(e.target.value))) })} className="h-8" aria-label="Target" title="Target" />
      <Input type="number" min={0} value={m.rewardCoins} onChange={(e) => setM({ ...m, rewardCoins: Math.max(0, Math.floor(Number(e.target.value))) })} className="h-8" aria-label="Reward coins" title="Reward RC" />
      <Input type="number" min={0} value={m.rewardXp} onChange={(e) => setM({ ...m, rewardXp: Math.max(0, Math.floor(Number(e.target.value))) })} className="h-8" aria-label="Reward XP" title="Reward XP" />
      <label className="flex items-center gap-2 text-xs"><Switch checked={m.isActive} onCheckedChange={(v) => setM({ ...m, isActive: v })} /> Active</label>
      <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Save
      </Button>
    </div>
  );
}
