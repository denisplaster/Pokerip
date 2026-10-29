"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Ban, ChevronLeft, ChevronRight, LoaderCircle, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { RC } from "@/components/common/coin-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/components/providers";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  role: "USER" | "ADMIN";
  level: number;
  packsOpened: number;
  isBot: boolean;
  suspendedAt: string | null;
  createdAt: string;
  wallet: { balance: number } | null;
  _count: { cards: number };
}

interface UserDetail {
  user: UserRow & { xp: number; boxesOpened: number; loginStreak: number; profileVisibility: string; wallet: { balance: number; lifetimeEarned: number; lifetimeSpent: number } | null; _count: { cards: number; listings: number; achievements: number } };
  transactions: { id: string; type: string; amount: number; balanceAfter: number; description: string; createdAt: string; admin: { username: string } | null }[];
  ledgerConsistent: boolean;
}

export function AdminUsers() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const dq = useDeferredValue(q);
  const { data, isFetching } = useQuery({
    queryKey: ["admin-users", dq, page],
    queryFn: () => api<{ items: UserRow[]; total: number; page: number; pages: number }>(`/api/admin/users?page=${page}&q=${encodeURIComponent(dq)}`),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search username or email…" className="pl-9" aria-label="Search users" />
      </div>
      <div className={cn("overflow-hidden rounded-2xl border bg-card transition-opacity", isFetching && "opacity-70")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Level</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Packs</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Cards</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((u) => (
              <TableRow key={u.id} className="cursor-pointer" onClick={() => setSelected(u.id)}>
                <TableCell>
                  <button className="font-semibold hover:underline" onClick={() => setSelected(u.id)}>{u.username}</button>
                  <p className="text-[11px] text-muted-foreground">Joined {formatDate(u.createdAt)}</p>
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{u.email ?? "—"}</TableCell>
                <TableCell className="text-right"><RC amount={u.wallet?.balance ?? 0} compact /></TableCell>
                <TableCell className="hidden text-right tabular sm:table-cell">{u.level}</TableCell>
                <TableCell className="hidden text-right tabular lg:table-cell">{u.packsOpened}</TableCell>
                <TableCell className="hidden text-right tabular lg:table-cell">{u._count.cards}</TableCell>
                <TableCell className="space-x-1">
                  {u.role === "ADMIN" && <Badge variant="gold">Admin</Badge>}
                  {u.isBot && <Badge variant="outline">Demo</Badge>}
                  {u.suspendedAt && <Badge variant="destructive">Suspended</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data && data.pages > 1 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft /> Prev</Button>
          <span className="text-xs text-muted-foreground">Page {data.page} of {data.pages} · {data.total} users</span>
          <Button size="sm" variant="outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight /></Button>
        </div>
      )}
      <UserSheet userId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function UserSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const me = useUser();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => api<UserDetail>(`/api/admin/users/${userId}`),
    enabled: Boolean(userId),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-user", userId] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  const adjust = useMutation({
    mutationFn: () => api<{ balance: number }>(`/api/admin/users/${userId}/adjust`, { body: { amount: Number(amount), reason } }),
    onSuccess: (r) => {
      toast.success(`Balance adjusted — now ${r.balance.toLocaleString()} RC`);
      setAmount("");
      setReason("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (body: { role?: "USER" | "ADMIN"; suspended?: boolean }) => api(`/api/admin/users/${userId}`, { method: "PATCH", body }),
    onSuccess: () => {
      toast.success("User updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const amt = Number(amount);
  const validAdjust = Number.isInteger(amt) && amt !== 0 && Math.abs(amt) <= 10_000_000 && reason.trim().length >= 5;
  const u = data?.user;
  const self = u?.id === me?.id;

  return (
    <Sheet open={Boolean(userId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{u?.username ?? "User"}</SheetTitle>
          <SheetDescription>{u?.email ?? (u?.isBot ? "Demo collector" : "")}</SheetDescription>
        </SheetHeader>
        {isLoading || !u ? (
          <div className="flex h-40 items-center justify-center"><LoaderCircle className="animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6 px-4 pb-8">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white/[0.04] p-2"><p className="text-muted-foreground">Balance</p><RC amount={u.wallet?.balance ?? 0} compact className="justify-center" /></div>
              <div className="rounded-lg bg-white/[0.04] p-2"><p className="text-muted-foreground">Earned</p><RC amount={u.wallet?.lifetimeEarned ?? 0} compact className="justify-center" /></div>
              <div className="rounded-lg bg-white/[0.04] p-2"><p className="text-muted-foreground">Spent</p><RC amount={u.wallet?.lifetimeSpent ?? 0} compact className="justify-center" /></div>
              <div className="rounded-lg bg-white/[0.04] p-2"><p className="text-muted-foreground">Level</p><p className="font-semibold">{u.level}</p></div>
              <div className="rounded-lg bg-white/[0.04] p-2"><p className="text-muted-foreground">Packs</p><p className="font-semibold">{u.packsOpened}</p></div>
              <div className="rounded-lg bg-white/[0.04] p-2"><p className="text-muted-foreground">Cards</p><p className="font-semibold">{u._count.cards}</p></div>
            </div>
            <p className={cn("flex items-center gap-2 rounded-lg p-2 text-xs", data.ledgerConsistent ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200")}>
              {data.ledgerConsistent ? <BadgeCheck className="size-4" /> : <TriangleAlert className="size-4" />}
              {data.ledgerConsistent ? "Ledger reconciles with wallet balance." : "Ledger does NOT reconcile with the wallet balance — investigate."}
            </p>

            <section className="space-y-3 rounded-xl border p-4">
              <h3 className="text-sm font-semibold">Adjust Rip Coin balance</h3>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <div className="space-y-1">
                  <Label htmlFor="adj-amount" className="text-xs">Amount (±RC)</Label>
                  <Input id="adj-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9-]/g, ""))} placeholder="e.g. 500 or -200" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adj-reason" className="text-xs">Reason (audit log)</Label>
                  <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Compensation for…" maxLength={200} />
                </div>
              </div>
              <Button size="sm" disabled={!validAdjust || adjust.isPending} onClick={() => adjust.mutate()}>
                {adjust.isPending && <LoaderCircle className="animate-spin" />} Apply adjustment
              </Button>
              <p className="text-[11px] text-muted-foreground">Recorded as an ADMIN_ADJUSTMENT ledger entry with your name. Balances can never go below zero.</p>
            </section>

            <section className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={self || update.isPending} onClick={() => update.mutate({ role: u.role === "ADMIN" ? "USER" : "ADMIN" })}>
                <ShieldCheck /> {u.role === "ADMIN" ? "Remove admin" : "Make admin"}
              </Button>
              <Button size="sm" variant={u.suspendedAt ? "outline" : "destructive"} disabled={self || update.isPending} onClick={() => update.mutate({ suspended: !u.suspendedAt })}>
                <Ban /> {u.suspendedAt ? "Unsuspend" : "Suspend"}
              </Button>
              {self && <p className="w-full text-[11px] text-muted-foreground">You can&apos;t change your own role or suspend yourself.</p>}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Recent transactions</h3>
              <ul className="divide-y rounded-xl border text-xs">
                {data.transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate">{t.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(t.createdAt, { dateStyle: "short", timeStyle: "short" })} · {t.type}
                        {t.admin ? ` · by ${t.admin.username}` : ""}
                      </p>
                    </div>
                    <span className={cn("shrink-0 font-semibold tabular", t.amount > 0 ? "text-emerald-300" : "text-rose-300")}>
                      {t.amount > 0 ? "+" : ""}
                      {t.amount.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
