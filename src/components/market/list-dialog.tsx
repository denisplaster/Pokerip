"use client";

import { LoaderCircle, Tag } from "lucide-react";
import { useState } from "react";
import { RC } from "@/components/common/coin-icon";
import { PokeCard, type CardFaceData } from "@/components/cards/poke-card";
import { usePublicConfig } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCardActions } from "@/hooks/use-card-actions";
import { LISTING_MAX_PRICE, LISTING_MIN_PRICE } from "@/lib/constants";

export function ListDialog({
  open,
  onOpenChange,
  userCardId,
  card,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userCardId: string;
  card: CardFaceData & { currentValue: number };
}) {
  const { marketplaceFeeBps, instantSellBps } = usePublicConfig();
  const { list } = useCardActions();
  const [price, setPrice] = useState(String(card.currentValue));
  const value = Math.floor(Number(price));
  const valid = Number.isFinite(value) && value >= LISTING_MIN_PRICE && value <= LISTING_MAX_PRICE;
  const fee = valid ? Math.floor((value * marketplaceFeeBps) / 10_000) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>List {card.name} for sale</DialogTitle>
          <DialogDescription>Other collectors can buy it with Rip Coins. You can cancel any time before it sells.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[110px_1fr] gap-4">
          <PokeCard card={card} sizes="110px" />
          <form
            id="list-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid) return;
              list.mutate({ userCardId, price: value }, { onSuccess: () => onOpenChange(false) });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (RC)</Label>
              <Input id="price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} aria-invalid={!valid} autoFocus />
              <div className="flex gap-1">
                {[0.9, 1, 1.15, 1.3].map((m) => (
                  <button key={m} type="button" onClick={() => setPrice(String(Math.max(1, Math.round(card.currentValue * m))))} className="rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                    {m === 1 ? "At value" : `${m > 1 ? "+" : ""}${Math.round((m - 1) * 100)}%`}
                  </button>
                ))}
              </div>
            </div>
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Virtual value</dt>
                <dd><RC amount={card.currentValue} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Marketplace fee ({marketplaceFeeBps / 100}%)</dt>
                <dd><RC amount={-fee} /></dd>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <dt>You receive</dt>
                <dd><RC amount={valid ? value - fee : 0} className="text-emerald-300" /></dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Instant sell instead</dt>
                <dd><RC amount={Math.max(1, Math.floor((card.currentValue * instantSellBps) / 10_000))} /></dd>
              </div>
            </dl>
          </form>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="list-form" disabled={!valid || list.isPending}>
            {list.isPending ? <LoaderCircle className="animate-spin" /> : <Tag />} List for {valid ? value.toLocaleString() : "—"} RC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
