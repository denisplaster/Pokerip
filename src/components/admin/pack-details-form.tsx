"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useState } from "react";
import { PACK_THEMES } from "@/components/packs/pack-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export interface PackDetails {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  price: number;
  cardsPerPack: number;
  theme: string;
  isActive: boolean;
  featured: boolean;
  sortOrder: number;
}

export const EMPTY_PACK: PackDetails = { name: "", slug: "", tagline: "", description: "", price: 500, cardsPerPack: 5, theme: "trainer", isActive: false, featured: false, sortOrder: 50 };

export function PackDetailsForm({ initial, onSubmit, pending, submitLabel = "Save details", isNew }: { initial: PackDetails; onSubmit: (v: PackDetails) => void; pending?: boolean; submitLabel?: string; isNew?: boolean }) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof PackDetails>(k: K, value: PackDetails[K]) => setV((p) => ({ ...p, [k]: value }));
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="p-name">Name</Label>
        <Input id="p-name" value={v.name} onChange={(e) => { set("name", e.target.value); if (isNew) set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-slug">Slug</Label>
        <Input id="p-slug" value={v.slug} onChange={(e) => set("slug", e.target.value)} required />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="p-tagline">Tagline</Label>
        <Input id="p-tagline" value={v.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={80} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="p-desc">Description</Label>
        <Textarea id="p-desc" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={400} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-price">Price (RC)</Label>
        <Input id="p-price" type="number" min={0} value={v.price} onChange={(e) => set("price", Math.max(0, Math.floor(Number(e.target.value))))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-cards">Cards per pack</Label>
        <Input id="p-cards" type="number" min={1} max={20} value={v.cardsPerPack} onChange={(e) => set("cardsPerPack", Math.min(20, Math.max(1, Math.floor(Number(e.target.value)))))} />
      </div>
      <div className="space-y-1.5">
        <Label>Theme</Label>
        <Select value={v.theme} onValueChange={(t) => set("theme", t)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.keys(PACK_THEMES).map((t) => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-sort">Sort order</Label>
        <Input id="p-sort" type="number" min={0} value={v.sortOrder} onChange={(e) => set("sortOrder", Math.max(0, Math.floor(Number(e.target.value))))} />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={v.isActive} onCheckedChange={(c) => set("isActive", c)} disabled={isNew} /> Active (purchasable)
      </label>
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={v.featured} onCheckedChange={(c) => set("featured", c)} /> Featured
      </label>
      {isNew && <p className="text-xs text-muted-foreground sm:col-span-2">New packs start inactive. Configure odds and the card pool, then activate.</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending || !v.name || !v.slug}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Save />} {submitLabel}
        </Button>
      </div>
    </form>
  );
}
