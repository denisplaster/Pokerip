"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WALLET_KEY, type WalletState } from "@/hooks/use-wallet";

export interface ClientUser {
  id: string;
  username: string;
  role: "USER" | "ADMIN";
  avatar: string;
  image: string | null;
  level: number;
  xp: number;
}

const UserContext = createContext<ClientUser | null>(null);

export function useUser() {
  return useContext(UserContext);
}

export interface PublicConfig {
  instantSellBps: number;
  marketplaceFeeBps: number;
}

const ConfigContext = createContext<PublicConfig>({ instantSellBps: 7000, marketplaceFeeBps: 500 });

/** Economy parameters the client needs for previews (the server always recomputes). */
export function usePublicConfig() {
  return useContext(ConfigContext);
}

export function Providers({
  user,
  initialWallet,
  config,
  children,
}: {
  user: ClientUser | null;
  initialWallet: WalletState | null;
  config: PublicConfig;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
      }),
  );
  // Seed the wallet cache from the server render, and reset caches when the signed-in user changes.
  const lastUser = useRef<string | null | undefined>(undefined);
  if (lastUser.current !== (user?.id ?? null)) {
    if (lastUser.current !== undefined) queryClient.clear();
    if (initialWallet) queryClient.setQueryData(WALLET_KEY, initialWallet);
    lastUser.current = user?.id ?? null;
  }
  useEffect(() => {
    if (initialWallet) queryClient.setQueryData(WALLET_KEY, initialWallet);
  }, [initialWallet, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <UserContext.Provider value={user}>
        <ConfigContext.Provider value={config}>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ConfigContext.Provider>
      </UserContext.Provider>
    </QueryClientProvider>
  );
}
