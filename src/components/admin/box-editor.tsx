"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, LoaderCircle, Plus, Save, Search, Trash, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { PokeCard } from "@/components/cards/poke-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { PPM } from "@/lib/probability";
import { cn } from "@/lib/utils";
import type { CardView } from "@/server/services/cards";
import { Panel } from "./admin-ui";

type RewardType = "CARD" | "CARD_BUNDLE" | "COINS" | "PACK_VOUCHER" | "COLLECTIBLE";

export interface BoxRewardForm {
  key: string;
  type: RewardType;
  label: string;
  percent: string;
  coins: string;
  packId: string;
  collectibleId: string;
  fallbackCoins: string;
  cards: { cardId: string; quantity: number; card: CardView }[];
}

export interface BoxForm {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  price: number;
  theme: string;
  isActive: boolean;
  featured: boolean;
  sortOrder: number;
  rewards: BoxRewardForm[];
}

const TYPE_LABEL: Record<RewardType, string> = { COINS: "Rip Coins", CARD: "Single card", CARD_BUNDLE: "Card bundle", PACK_VOUCHER: "Free pack voucher", COLLECTIBLE: "Limited collectible" };
let seq = 0;
export const newReward = (): BoxRewardForm => ({ key: `r${++seq}`, type: "COINS", label: "", percent: "0", coins: "100", packId: "", collectibleId: "", fallbackCoins: "0", cards: [] });

export function BoxEditor({
  boxId,
  initial,
  packs,
  collectibles,
}: {
  boxId: string | null;
  initial: BoxForm;
  packs: { id: string; name: string }[];
  collectibles: { id: string; name: string; maxSupply: number | null; mintedCount: number }[];
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const set = <K extends keyof BoxForm>(k: K, v: BoxForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const setReward = (key: string, patch: Partial<BoxRewardForm>) => setF((p) => ({ ...p, rewards: p.rewards.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const sum = f.rewards.reduce((s, r) => s + Math.round(Number(r.percent || 0) * 10_000), 0);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...f,
        rewards: f.rewards.map((r) => ({
          type: r.type,
          label: r.label,
          weightPpm: Math.round(Number(r.percent || 0) * 10_000),
          coins: r.type === "COINS" ? Math.floor(Number(r.coins)) || null : null,
          packId: r.type === "PACK_VOUCHER" ? r.packId || null : null,
          collectibleId: r.type === "COLLECTIBLE" ? r.collectibleId || null : null,
          fallbackCoins: r.type === "COLLECTIBLE" ? Math.floor(Number(r.fallbackCoins)) : null,
          cards: r.type === "CARD" || r.type === "CARD_BUNDLE" ? r.cards.map((c) => ({ cardId: c.cardId, quantity: c.quantity })) : [],
        })),
      };
      return boxId ? api<{ id: string; oddsVersion: number }>(`/api/admin/boxes/${boxId}`, { method: "PUT", body }) : api<{ id: string; oddsVersion: number }>("/api/admin/boxes", { body });
    },
    onSuccess: (r) => {
      toast.success(`Saved — odds version ${r.oddsVersion} published`);
      if (!boxId) router.push(`/admin/boxes/${r.id}`);
      else router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Panel title="Details">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={f.name} onChange={(e) => { set("name", e.target.value); if (!boxId) set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></div>
          <div className="space-y-1"><Label className="text-xs">Slug</Label><Input value={f.slug} onChange={(e) => set("slug", e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Tagline</Label><Input value={f.tagline} onChange={(e) => set("tagline", e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Description</Label><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Price (RC)</Label><Input type="number" min={0} value={f.price} onChange={(e) => set("price", Math.max(0, Math.floor(Number(e.target.value))))} /></div>
          <div className="space-y-1">
            <Label className="text-xs">Theme</Label>
            <Select value={f.theme} onValueChange={(v) => set("theme", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{["cyan", "purple", "gold", "rose"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Sort order</Label><Input type="number" value={f.sortOrder} onChange={(e) => set("sortOrder", Math.max(0, Math.floor(Number(e.target.value))))} /></div>
          <div className="flex items-end gap-6 pb-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={f.isActive} onCheckedChange={(v) => set("isActive", v)} /> Active</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={f.featured} onCheckedChange={(v) => set("featured", v)} /> Featured</label>
          </div>
        </div>
      </Panel>

      <Panel
        title="Rewards & odds"
        description="Exactly one reward is drawn per opening. Probabilities must total 100%."
        actions={
          <span className={cn("flex items-center gap-1.5 text-sm font-semibold tabular", sum === PPM ? "text-emerald-300" : "text-amber-300")}>
            {sum === PPM ? <CircleCheck className="size-4" /> : <TriangleAlert className="size-4" />} {(sum / 10_000).toFixed(4)}%
          </span>
        }
      >
        <div className="space-y-3">
          {f.rewards.map((r) => (
            <div key={r.key} className="space-y-3 rounded-xl border p-3">
              <div className="grid gap-2 sm:grid-cols-[170px_1fr_120px_auto]">
                <Select value={r.type} onValueChange={(v) => setReward(r.key, { type: v as RewardType })}>
                  <SelectTrigger className="w-full" aria-label="Reward type"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(TYPE_LABEL) as RewardType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={r.label} onChange={(e) => setReward(r.key, { label: e.target.value })} placeholder="Label shown to players" aria-label="Label" />
                <div className="flex items-center gap-1">
                  <Input type="number" step="0.0001" min={0} max={100} value={r.percent} onChange={(e) => setReward(r.key, { percent: e.target.value })} aria-label="Probability percent" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setF((p) => ({ ...p, rewards: p.rewards.filter((x) => x.key !== r.key) }))} aria-label="Remove reward"><Trash /></Button>
              </div>
              {r.type === "COINS" && (
                <div className="flex items-center gap-2 text-sm"><Label className="text-xs">Coins</Label><Input type="number" min={1} className="w-40" value={r.coins} onChange={(e) => setReward(r.key, { coins: e.target.value })} /></div>
              )}
              {r.type === "PACK_VOUCHER" && (
                <Select value={r.packId} onValueChange={(v) => setReward(r.key, { packId: v })}>
                  <SelectTrigger className="w-64"><SelectValue placeholder="Choose pack" /></SelectTrigger>
                  <SelectContent>{packs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {r.type === "COLLECTIBLE" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={r.collectibleId} onValueChange={(v) => setReward(r.key, { collectibleId: v })}>
                    <SelectTrigger className="w-72"><SelectValue placeholder="Choose collectible" /></SelectTrigger>
                    <SelectContent>
                      {collectibles.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} {c.maxSupply ? `(${c.mintedCount}/${c.maxSupply} minted)` : "(unlimited)"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label className="text-xs">Sold-out fallback (RC)</Label>
                  <Input type="number" min={0} className="w-32" value={r.fallbackCoins} onChange={(e) => setReward(r.key, { fallbackCoins: e.target.value })} />
                </div>
              )}
              {(r.type === "CARD" || r.type === "CARD_BUNDLE") && <CardsPicker reward={r} single={r.type === "CARD"} onChange={(cards) => setReward(r.key, { cards })} />}
            </div>
          ))}
          <Button variant="outline" onClick={() => setF((p) => ({ ...p, rewards: [...p.rewards, newReward()] }))}><Plus /> Add reward</Button>
        </div>
      </Panel>

      <Button size="lg" onClick={() => save.mutate()} disabled={save.isPending || sum !== PPM || !f.name || !f.slug || f.rewards.length === 0}>
        {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Save & publish odds
      </Button>
    </div>
  );
}

function CardsPicker({ reward, single, onChange }: { reward: BoxRewardForm; single: boolean; onChange: (cards: BoxRewardForm["cards"]) => void }) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const { data } = useQuery({
    queryKey: ["admin-card-search", dq],
    queryFn: () => api<{ items: (CardView & { isActive: boolean })[] }>(`/api/admin/cards?limit=8&q=${encodeURIComponent(dq)}`),
    enabled: dq.trim().length >= 2,
  });
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2">
        {reward.cards.map((c) => (
          <li key={c.cardId} className="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs">
            <span className="w-5"><PokeCard card={c.card} sizes="20px" holo={false} /></span>
            {c.card.name}
            {!single && (
              <Input type="number" min={1} max={20} value={c.quantity} className="h-6 w-14 px-1 text-xs" onChange={(e) => onChange(reward.cards.map((x) => (x.cardId === c.cardId ? { ...x, quantity: Math.max(1, Math.floor(Number(e.target.value))) } : x)))} aria-label="Quantity" />
            )}
            <button onClick={() => onChange(reward.cards.filter((x) => x.cardId !== c.cardId))} aria-label={`Remove ${c.card.name}`}><Trash className="size-3.5 text-muted-foreground" /></button>
          </li>
        ))}
      </ul>
      {(!single || reward.cards.length === 0) && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a card to add…" className="h-8 pl-8 text-xs" />
          {data && dq.trim().length >= 2 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border bg-popover p-1 shadow-2xl">
              {data.items.filter((c) => c.isActive).map((c) => (
                <li key={c.id}>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-white/[0.06] disabled:opacity-40"
                    disabled={reward.cards.some((x) => x.cardId === c.id)}
                    onClick={() => {
                      onChange([...reward.cards, { cardId: c.id, quantity: 1, card: c }]);
                      setQ("");
                    }}
                  >
                    <span className="w-5"><PokeCard card={c} sizes="20px" holo={false} /></span>
                    <span className="truncate">{c.name} · {c.set.name} {c.number}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
