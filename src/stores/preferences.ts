"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PreferencesState {
  muted: boolean;
  volume: number;
  skipAnimations: boolean;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setVolume: (volume: number) => void;
  setSkipAnimations: (skip: boolean) => void;
}

/** Client-only UI preferences, persisted to localStorage. */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      muted: false,
      volume: 0.6,
      skipAnimations: false,
      setMuted: (muted) => set({ muted }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setSkipAnimations: (skipAnimations) => set({ skipAnimations }),
    }),
    { name: "ripvault-preferences", storage: createJSONStorage(() => localStorage) },
  ),
);
