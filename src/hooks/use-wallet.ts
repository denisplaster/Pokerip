"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "@/lib/api-client";

export interface WalletState {
  balance: number;
  vouchers: Record<string, number>;
  dailyClaimable: boolean;
}

export const WALLET_KEY = ["wallet"] as const;

/** Live wallet balance: polled, and updated instantly from mutation responses. */
export function useWallet(enabled = true) {
  return useQuery({
    queryKey: WALLET_KEY,
    queryFn: () => api<WalletState>("/api/wallet"),
    enabled,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });
}

export function useSetBalance() {
  const qc = useQueryClient();
  return useCallback(
    (balance: number | null | undefined) => {
      if (typeof balance !== "number") return;
      qc.setQueryData<WalletState>(WALLET_KEY, (prev) => (prev ? { ...prev, balance } : { balance, vouchers: {}, dailyClaimable: false }));
    },
    [qc],
  );
}

export function useRefreshWallet() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: WALLET_KEY }), [qc]);
}
