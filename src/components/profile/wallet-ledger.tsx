"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { RC } from "@/components/common/coin-icon";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface LedgerRow {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  SIGNUP_BONUS: "Welcome bonus",
  PACK_PURCHASE: "Pack",
  MYSTERY_BOX_PURCHASE: "Mystery box",
  MYSTERY_BOX_REWARD: "Box reward",
  CARD_SALE: "Instant sale",
  MARKETPLACE_PURCHASE: "Market buy",
  MARKETPLACE_SALE: "Market sale",
  DAILY_REWARD: "Daily reward",
  MISSION_REWARD: "Mission",
  ACHIEVEMENT_REWARD: "Achievement",
  LEVEL_UP_REWARD: "Level up",
  ADMIN_ADJUSTMENT: "Adjustment",
};

/** The user's immutable Rip Coin ledger with balance before/after for every entry. */
export function WalletLedger() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["ledger"],
    queryFn: ({ pageParam }) => api<{ items: LedgerRow[]; nextCursor: string | null }>(`/api/wallet/transactions?limit=25${pageParam ? `&cursor=${pageParam}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = data?.pages.flatMap((p) => p.items) ?? [];
  if (isLoading) return <div className="flex h-32 items-center justify-center"><LoaderCircle className="animate-spin text-muted-foreground" /></div>;
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden sm:table-cell">Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="hidden text-right md:table-cell">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground">{formatDate(r.createdAt, { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                <TableCell className="text-xs">{TYPE_LABEL[r.type] ?? r.type}</TableCell>
                <TableCell className="hidden max-w-72 truncate text-xs text-muted-foreground sm:table-cell">{r.description}</TableCell>
                <TableCell className={cn("text-right font-semibold tabular", r.amount > 0 ? "text-emerald-300" : "text-rose-300")}>
                  {r.amount > 0 ? "+" : ""}
                  {r.amount.toLocaleString()}
                </TableCell>
                <TableCell className="hidden text-right md:table-cell">
                  <RC amount={r.balanceAfter} className="text-xs font-normal text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <LoaderCircle className="animate-spin" />} Load more
          </Button>
        </div>
      )}
    </div>
  );
}
