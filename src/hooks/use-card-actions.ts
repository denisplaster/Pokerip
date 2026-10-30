"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { ProgressNotice } from "@/lib/notices";
import { playSound } from "@/lib/sound";
import { useShowNotices } from "./use-notices";
import { useSetBalance } from "./use-wallet";

/** Mutations shared by the collection, card detail and marketplace screens. */
export function useCardActions() {
  const qc = useQueryClient();
  const setBalance = useSetBalance();
  const showNotices = useShowNotices();

  const refresh = () => {
    for (const key of ["collection", "card", "listings", "my-listings", "sales", "wallet", "missions"]) qc.invalidateQueries({ queryKey: [key] });
  };
  const onError = (e: Error) => {
    playSound("error");
    toast.error(e.message);
  };

  const sell = useMutation({
    mutationFn: (userCardIds: string[]) => api<{ sold: number; total: number; balance: number; notices: ProgressNotice[] }>("/api/collection/sell", { body: { userCardIds } }),
    onSuccess: (res) => {
      setBalance(res.balance);
      playSound("coin");
      toast.success(`Sold ${res.sold} card${res.sold === 1 ? "" : "s"} for ${res.total.toLocaleString()} RC`);
      showNotices(res.notices);
      refresh();
    },
    onError,
  });

  const sellDuplicates = useMutation({
    mutationFn: (input: { rarities: string[]; keep: number }) =>
      api<{ sold: number; total: number; balance: number | null; notices: ProgressNotice[] }>("/api/collection/sell-duplicates", { body: input }),
    onSuccess: (res) => {
      if (res.balance !== null) setBalance(res.balance);
      if (res.sold) {
        playSound("coin");
        toast.success(`Sold ${res.sold} duplicates for ${res.total.toLocaleString()} RC`);
      } else toast.info("No duplicates matched those rarities.");
      showNotices(res.notices);
      refresh();
    },
    onError,
  });

  const list = useMutation({
    mutationFn: (input: { userCardId: string; price: number }) => api<{ notices: ProgressNotice[] }>("/api/marketplace/listings", { body: input }),
    onSuccess: (res) => {
      playSound("click");
      toast.success("Listed on the marketplace");
      showNotices(res.notices);
      refresh();
    },
    onError,
  });

  const cancel = useMutation({
    mutationFn: (listingId: string) => api(`/api/marketplace/listings/${listingId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Listing cancelled — the card is back in your collection");
      refresh();
    },
    onError,
  });

  const buy = useMutation({
    mutationFn: (listingId: string) => api<{ price: number; balance: number; notices: ProgressNotice[] }>(`/api/marketplace/listings/${listingId}/buy`, { method: "POST", body: {} }),
    onSuccess: (res) => {
      setBalance(res.balance);
      playSound("coin");
      toast.success(`Purchased for ${res.price.toLocaleString()} RC — it's in your collection`);
      showNotices(res.notices);
      refresh();
    },
    onError: (e: Error) => {
      onError(e);
      refresh();
    },
  });

  const favorite = useMutation({
    mutationFn: (input: { cardId: string; favorite: boolean }) => api("/api/collection/favorite", { body: input }),
    onSuccess: (_r, vars) => {
      toast.success(vars.favorite ? "Added to favourites" : "Removed from favourites");
      refresh();
    },
    onError,
  });

  return { sell, sellDuplicates, list, cancel, buy, favorite };
}
