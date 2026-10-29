"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LoaderCircle, Pencil, Plus, Save, Search, Trash } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { RC } from "@/components/common/coin-icon";
import { ENERGY } from "@/components/cards/energy";
import { PokeCard } from "@/components/cards/poke-card";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { RARITIES, RARITY_META, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { CardView } from "@/server/services/cards";

type AdminCard = CardView & { baseValue: number; isActive: boolean; setId: string; _count: { owned: number; pools: number } };
interface SetOption {
  id: string;
  code: string;
  name: string;
}

const CATEGORIES = ["VINTAGE", "MODERN", "ILLUSTRATION", "GRADED", "PROMO"] as const;

interface FormState {
  name: string;
  pokemon: string;
  setId: string;
  number: string;
  variant: string;
  rarity: RarityKey;
  energyType: string;
  imageUrl: string;
  grade: string;
  releaseYear: number;
  category: (typeof CATEGORIES)[number];
  baseValue: number;
  currentValue: number;
  isActive: boolean;
}

function toForm(card: AdminCard | null, sets: SetOption[]): FormState {
  if (!card)
    return { name: "", pokemon: "", setId: sets[0]?.id ?? "", number: "", variant: "", rarity: "COMMON", energyType: "colorless", imageUrl: "", grade: "", releaseYear: new Date().getFullYear(), category: "MODERN", baseValue: 10, currentValue: 10, isActive: true };
  return {
    name: card.name,
    pokemon: card.pokemon ?? "",
    setId: card.setId,
    number: card.number,
    variant: card.variant ?? "",
    rarity: card.rarity,
    energyType: card.energyType,
    imageUrl: card.imageUrl ?? "",
    grade: card.grade ?? "",
    releaseYear: card.releaseYear,
    category: card.category as FormState["category"],
    baseValue: card.baseValue,
    currentValue: card.currentValue,
    isActive: card.isActive,
  };
}

export function AdminCards({ sets }: { sets: SetOption[] }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<RarityKey | "all">("all");
  const [setId, setSetId] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminCard | "new" | null>(null);
  const dq = useDeferredValue(q);
  const params = new URLSearchParams({ page: String(page), limit: "30" });
  if (dq) params.set("q", dq);
  if (rarity !== "all") params.set("rarity", rarity);
  if (setId !== "all") params.set("setId", setId);
  const { data, isFetching } = useQuery({
    queryKey: ["admin-cards", params.toString()],
    queryFn: () => api<{ items: AdminCard[]; total: number; page: number; pages: number }>(`/api/admin/cards?${params}`),
    placeholderData: keepPreviousData,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<{ removed: boolean; retired: boolean }>(`/api/admin/cards/${id}`, { method: "DELETE" }),
    onSuccess: (r) => {
      toast.success(r.removed ? "Card deleted" : "Card retired — it's owned by collectors, so it was deactivated and removed from all pools");
      qc.invalidateQueries({ queryKey: ["admin-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name, slug or number…" className="pl-9" aria-label="Search cards" />
        </div>
        <Select value={rarity} onValueChange={(v) => { setRarity(v as RarityKey | "all"); setPage(1); }}>
          <SelectTrigger className="w-40" aria-label="Rarity"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rarities</SelectItem>
            {RARITIES.map((r) => <SelectItem key={r} value={r}>{RARITY_META[r].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={setId} onValueChange={(v) => { setSetId(v); setPage(1); }}>
          <SelectTrigger className="w-48" aria-label="Set"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sets</SelectItem>
            {sets.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setEditing("new")}><Plus /> Add card</Button>
      </div>
      <div className={cn("overflow-hidden rounded-2xl border bg-card transition-opacity", isFetching && "opacity-70")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Card</TableHead>
              <TableHead className="hidden sm:table-cell">Rarity</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="hidden text-right md:table-cell">Base</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Owned</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Packs</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((c) => (
              <TableRow key={c.id} className={cn(!c.isActive && "opacity-50")}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="w-7 shrink-0"><PokeCard card={c} sizes="28px" holo={false} /></span>
                    <span className="min-w-0">
                      <span className="block max-w-56 truncate font-medium">{c.name} {!c.isActive && <Badge variant="secondary">Retired</Badge>}</span>
                      <span className="block max-w-56 truncate text-[11px] text-muted-foreground">{c.set.name} {c.number}{c.variant ? ` · ${c.variant}` : ""}{c.grade ? ` · ${c.grade}` : ""}</span>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell"><RarityBadge rarity={c.rarity} short /></TableCell>
                <TableCell className="text-right"><RC amount={c.currentValue} compact /></TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular md:table-cell">{c.baseValue.toLocaleString()}</TableCell>
                <TableCell className="hidden text-right tabular lg:table-cell">{c._count.owned}</TableCell>
                <TableCell className="hidden text-right tabular lg:table-cell">{c._count.pools}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}><Pencil /></Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (confirm(c._count.owned ? `"${c.name}" is owned by collectors. Retire it (deactivate and remove from all pack pools)?` : `Delete "${c.name}" permanently?`)) remove.mutate(c.id);
                    }}
                    aria-label={`Remove ${c.name}`}
                  >
                    <Trash />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft /> Prev</Button>
          <span className="text-xs text-muted-foreground">Page {data.page} of {data.pages} · {data.total} cards</span>
          <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight /></Button>
        </div>
      )}
      {editing && <CardDialog key={editing === "new" ? "new" : editing.id} card={editing === "new" ? null : editing} sets={sets} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CardDialog({ card, sets, onClose }: { card: AdminCard | null; sets: SetOption[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<FormState>(() => toForm(card, sets));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...f,
        pokemon: f.pokemon.trim() || null,
        variant: f.variant.trim() || null,
        imageUrl: f.imageUrl.trim() || null,
        grade: f.grade.trim() || null,
      };
      return card ? api(`/api/admin/cards/${card.id}`, { method: "PATCH", body }) : api("/api/admin/cards", { body });
    },
    onSuccess: () => {
      toast.success(card ? "Card updated" : "Card added");
      qc.invalidateQueries({ queryKey: ["admin-cards"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const previewCard = { ...f, variant: f.variant || null, dexNumber: null, imageUrl: f.imageUrl || null, grade: f.grade || null, set: { name: sets.find((s) => s.id === f.setId)?.name ?? "" } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{card ? `Edit ${card.name}` : "Add card"}</DialogTitle>
          <DialogDescription>Values are fictional Rip Coin amounts. Changing the current value records a price-history point.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[160px_1fr]">
          <div className="w-40"><PokeCard card={previewCard} sizes="160px" /></div>
          <form id="card-form" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Field label="Name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} required /></Field>
            <Field label="Pokémon (for search)"><Input value={f.pokemon} onChange={(e) => set("pokemon", e.target.value)} /></Field>
            <Field label="Set">
              <Select value={f.setId} onValueChange={(v) => set("setId", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{sets.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Number"><Input value={f.number} onChange={(e) => set("number", e.target.value)} required placeholder="4/102" /></Field>
            <Field label="Variant"><Input value={f.variant} onChange={(e) => set("variant", e.target.value)} placeholder="Holo, Alternate Art…" /></Field>
            <Field label="Grade (optional)"><Input value={f.grade} onChange={(e) => set("grade", e.target.value)} placeholder="PSA 10" /></Field>
            <Field label="Rarity">
              <Select value={f.rarity} onValueChange={(v) => set("rarity", v as RarityKey)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{RARITIES.map((r) => <SelectItem key={r} value={r}>{RARITY_META[r].label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Energy type">
              <Select value={f.energyType} onValueChange={(v) => set("energyType", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ENERGY).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={f.category} onValueChange={(v) => set("category", v as FormState["category"])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Release year"><Input type="number" value={f.releaseYear} onChange={(e) => set("releaseYear", Math.floor(Number(e.target.value)))} /></Field>
            <Field label="Base value (RC)"><Input type="number" min={1} value={f.baseValue} onChange={(e) => set("baseValue", Math.max(1, Math.floor(Number(e.target.value))))} /></Field>
            <Field label="Current value (RC)"><Input type="number" min={1} value={f.currentValue} onChange={(e) => set("currentValue", Math.max(1, Math.floor(Number(e.target.value))))} /></Field>
            <div className="sm:col-span-2"><Field label="Image URL (optional — must be licensed)"><Input value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://assets.tcgdex.net/…" /></Field></div>
            <label className="flex items-center gap-3 text-sm sm:col-span-2"><Switch checked={f.isActive} onCheckedChange={(v) => set("isActive", v)} /> Active (eligible for packs)</label>
          </form>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="card-form" disabled={save.isPending || !f.name || !f.number}>
            {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} {card ? "Save changes" : "Add card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
