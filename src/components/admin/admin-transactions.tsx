"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPES = ["SIGNUP_BONUS", "PACK_PURCHASE", "MYSTERY_BOX_PURCHASE", "MYSTERY_BOX_REWARD", "CARD_SALE", "MARKETPLACE_PURCHASE", "MARKETPLACE_SALE", "DAILY_REWARD", "MISSION_REWARD", "ACHIEVEMENT_REWARD", "LEVEL_UP_REWARD", "ADMIN_ADJUSTMENT"];

interface Row {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  idempotencyKey: string | null;
  user: { id: string; username: string };
  admin: { username: string } | null;
}

export function AdminTransactions() {
  const [type, setType] = useState("all");
  const [username, setUsername] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const du = useDeferredValue(username);
  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (type !== "all") params.set("type", type);
  if (du) params.set("username", du);
  if (from) params.set("from", new Date(`${from}T00:00:00Z`).toISOString());
  if (to) params.set("to", new Date(`${to}T23:59:59Z`).toISOString());
  const { data, isFetching } = useQuery({
    queryKey: ["admin-transactions", params.toString()],
    queryFn: () => api<{ items: Row[]; total: number; net: number; page: number; pages: number }>(`/api/admin/transactions?${params}`),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((t) => <SelectItem key={t} value={t}>{t.replaceAll("_", " ").toLowerCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">User</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={username} onChange={(e) => { setUsername(e.target.value); setPage(1); }} placeholder="Username" className="w-48 pl-8" />
          </div>
        </div>
        <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" /></div>
        <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" /></div>
        {data && (
          <p className="ml-auto text-xs text-muted-foreground">
            {data.total.toLocaleString()} entries · net <span className={cn("font-semibold tabular", data.net >= 0 ? "text-emerald-300" : "text-rose-300")}>{data.net.toLocaleString()} RC</span>
          </p>
        )}
      </div>
      <div className={cn("overflow-hidden rounded-2xl border bg-card transition-opacity", isFetching && "opacity-70")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden lg:table-cell">Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="hidden text-right md:table-cell">Before → After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-xs text-muted-foreground">{formatDate(t.createdAt, { dateStyle: "short", timeStyle: "medium" })}</TableCell>
                <TableCell className="text-sm font-medium">{t.user.username}</TableCell>
                <TableCell className="text-xs">{t.type.replaceAll("_", " ").toLowerCase()}{t.admin ? <span className="block text-[10px] text-amber-300">by {t.admin.username}</span> : null}</TableCell>
                <TableCell className="hidden max-w-80 truncate text-xs text-muted-foreground lg:table-cell" title={t.idempotencyKey ?? undefined}>{t.description}</TableCell>
                <TableCell className={cn("text-right font-semibold tabular", t.amount >= 0 ? "text-emerald-300" : "text-rose-300")}>{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}</TableCell>
                <TableCell className="hidden text-right text-xs tabular text-muted-foreground md:table-cell">{t.balanceBefore.toLocaleString()} → {t.balanceAfter.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data && data.pages > 1 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft /> Prev</Button>
          <span className="text-xs text-muted-foreground">Page {data.page} of {data.pages}</span>
          <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight /></Button>
        </div>
      )}
    </div>
  );
}
