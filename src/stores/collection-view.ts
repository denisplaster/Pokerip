"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RarityKey } from "@/lib/rarity";

export type CollectionSort = "value_desc" | "value_asc" | "recent" | "name" | "rarity" | "quantity";

interface CollectionViewState {
  search: string;
  rarities: RarityKey[];
  set: string | null;
  sort: CollectionSort;
  onlyFavorites: boolean;
  onlyDuplicates: boolean;
  density: "comfortable" | "compact";
  setSearch: (search: string) => void;
  toggleRarity: (rarity: RarityKey) => void;
  setSet: (set: string | null) => void;
  setSort: (sort: CollectionSort) => void;
  setOnlyFavorites: (v: boolean) => void;
  setOnlyDuplicates: (v: boolean) => void;
  setDensity: (d: "comfortable" | "compact") => void;
  reset: () => void;
}

const initial = { search: "", rarities: [] as RarityKey[], set: null, sort: "value_desc" as CollectionSort, onlyFavorites: false, onlyDuplicates: false };

/** Collection filters live in a store so they survive navigating to card details and back. */
export const useCollectionView = create<CollectionViewState>()(
  persist(
    (set) => ({
      ...initial,
      density: "comfortable",
      setSearch: (search) => set({ search }),
      toggleRarity: (rarity) => set((s) => ({ rarities: s.rarities.includes(rarity) ? s.rarities.filter((r) => r !== rarity) : [...s.rarities, rarity] })),
      setSet: (setCode) => set({ set: setCode }),
      setSort: (sort) => set({ sort }),
      setOnlyFavorites: (onlyFavorites) => set({ onlyFavorites }),
      setOnlyDuplicates: (onlyDuplicates) => set({ onlyDuplicates }),
      setDensity: (density) => set({ density }),
      reset: () => set(initial),
    }),
    { name: "ripvault-collection-view", partialize: (s) => ({ sort: s.sort, density: s.density }) },
  ),
);
