"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatedNumber } from "@/components/common/animated-number";
import { CoinIcon } from "@/components/common/coin-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";

/** Header balance with a live counter and floating +/- deltas on every change. */
export function WalletPill({ className }: { className?: string }) {
  const { data } = useWallet();
  const balance = data?.balance ?? 0;
  const prev = useRef<number | null>(null);
  const [deltas, setDeltas] = useState<{ id: number; amount: number }[]>([]);

  useEffect(() => {
    if (prev.current !== null && balance !== prev.current) {
      const amount = balance - prev.current;
      const id = Date.now() + Math.random();
      setDeltas((d) => [...d, { id, amount }]);
      setTimeout(() => setDeltas((d) => d.filter((x) => x.id !== id)), 1800);
    }
    prev.current = balance;
  }, [balance]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/profile#wallet"
          className={cn(
            "relative flex h-10 items-center gap-2 rounded-xl border border-amber-400/25 bg-gradient-to-b from-amber-400/[0.12] to-amber-400/[0.04] px-3 font-semibold text-amber-100 transition-colors hover:border-amber-400/45",
            className,
          )}
          aria-label={`Balance: ${balance.toLocaleString()} Rip Coins`}
        >
          <CoinIcon className="size-5" />
          <AnimatedNumber value={balance} className="tabular text-sm" />
          <span className="hidden text-xs font-medium text-amber-200/60 sm:inline">RC</span>
          <AnimatePresence>
            {deltas.map((d) => (
              <motion.span
                key={d.id}
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: 1, y: 22 }}
                exit={{ opacity: 0, y: 34 }}
                transition={{ duration: 0.6 }}
                className={cn(
                  "pointer-events-none absolute right-2 top-full whitespace-nowrap rounded-md px-1.5 text-xs font-bold tabular",
                  d.amount > 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300",
                )}
              >
                {d.amount > 0 ? "+" : ""}
                {d.amount.toLocaleString()}
              </motion.span>
            ))}
          </AnimatePresence>
        </Link>
      </TooltipTrigger>
      <TooltipContent>Rip Coins are fictional and have no real-world value.</TooltipContent>
    </Tooltip>
  );
}
