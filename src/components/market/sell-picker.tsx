"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RC } from "@/components/common/coin-icon";
import { PokeCard } from "@/components/cards/poke-card";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import type { CardView } from "@/server/services/cards";
import type { CollectionData } from "@/server/services/collection";
import { ListDialog } from "./list-dialog";

/** Pick a card from your collection to list on the marketplace. */
export function SellPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<{ userCardId: string; card: CardView } | null>(null);
  const [loadingCard, setLoadingCard] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["collection"],
    queryFn: () => api<CollectionData>("/api/collection"),
    enabled: open,
  });
  const needle = q.toLowerCase();
  const entries = (data?.entries ?? [])
    .filter((e) => e.quantity - e.listed > 0)
    .filter((e) => !needle || `${e.card.name} ${e.card.set.name}`.toLowerCase().includes(needle))
    .sort((a, b) => b.card.currentValue - a.card.currentValue);

  async function choose(card: CardView) {
    setLoadingCard(card.id);
    try {
      const { copies } = await api<{ copies: { id: string; status: string }[] }>(`/api/cards/${card.id}/copies`);
      const copy = copies.find((c) => c.status === "OWNED");
      if (!copy) throw new Error("Every copy of this card is already listed.");
      onOpenChange(false);
      setTarget({ userCardId: copy.id, card });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load copies");
    } finally {
      setLoadingCard(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sell a card</DialogTitle>
            <DialogDescription>Choose a card from your collection to list for Rip Coins.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your cards…" className="pl-9" aria-label="Search your cards" autoFocus />
          </div>
          <div className="max-h-[55vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center"><LoaderCircle className="animate-spin text-muted-foreground" /></div>
            ) : entries.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No unlisted cards found.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {entries.map((e) => (
                  <li key={e.card.id}>
                    <button
                      onClick={() => void choose(e.card)}
                      disabled={loadingCard !== null}
                      className="flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors hover:bg-white/[0.04] disabled:opacity-60"
                    >
                      <span className="w-10 shrink-0"><PokeCard card={e.card} sizes="40px" holo={false} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{e.card.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{e.card.set.name} · ×{e.quantity - e.listed} available</span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <RarityBadge rarity={e.card.rarity} short />
                        {loadingCard === e.card.id ? <LoaderCircle className="size-4 animate-spin" /> : <RC amount={e.card.currentValue} compact className="text-xs text-amber-200" />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {target && <ListDialog open onOpenChange={(o) => !o && setTarget(null)} userCardId={target.userCardId} card={target.card} />}
    </>
  );
}
