"use client";

import { LoaderCircle, ShoppingCart } from "lucide-react";
import { RC } from "@/components/common/coin-icon";
import { PokeCard, type CardFaceData } from "@/components/cards/poke-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCardActions } from "@/hooks/use-card-actions";
import { useWallet } from "@/hooks/use-wallet";

export interface BuyableListing {
  id: string;
  price: number;
  seller: { username: string };
  card: CardFaceData & { currentValue: number };
}

export function BuyDialog({ listing, onOpenChange }: { listing: BuyableListing | null; onOpenChange: (open: boolean) => void }) {
  const { buy } = useCardActions();
  const { data: wallet } = useWallet();
  const balance = wallet?.balance ?? 0;
  if (!listing) return null;
  const affordable = balance >= listing.price;
  return (
    <Dialog open={Boolean(listing)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buy {listing.card.name}?</DialogTitle>
          <DialogDescription>Sold by {listing.seller.username}. Purchases are final and use Rip Coins only.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[110px_1fr] gap-4">
          <PokeCard card={listing.card} sizes="110px" />
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Price</dt>
              <dd><RC amount={listing.price} className="text-amber-200" /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Virtual value</dt>
              <dd><RC amount={listing.card.currentValue} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Your balance</dt>
              <dd><RC amount={balance} /></dd>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-semibold">
              <dt>After purchase</dt>
              <dd><RC amount={balance - listing.price} className={affordable ? "" : "text-rose-300"} /></dd>
            </div>
          </dl>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!affordable || buy.isPending} onClick={() => buy.mutate(listing.id, { onSettled: () => onOpenChange(false) })}>
            {buy.isPending ? <LoaderCircle className="animate-spin" /> : <ShoppingCart />}
            {affordable ? `Buy for ${listing.price.toLocaleString()} RC` : "Not enough Rip Coins"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
