"use client";

import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { RC } from "@/components/common/coin-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { EMPTY_PACK, PackDetailsForm, type PackDetails } from "./pack-details-form";

interface Row {
  id: string;
  slug: string;
  name: string;
  price: number;
  cardsPerPack: number;
  isActive: boolean;
  featured: boolean;
  _count: { openings: number; pool: number };
  oddsVersions: { version: number; createdAt: string }[];
}

export function AdminPacksList({ packs }: { packs: Row[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const create = useMutation({
    mutationFn: (v: PackDetails) => api<{ id: string }>("/api/admin/packs", { body: v }),
    onSuccess: (p) => {
      toast.success("Pack created — now configure its odds and pool");
      router.push(`/admin/packs/${p.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <Button onClick={() => setOpen(true)}><Plus /> New pack</Button>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pack</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Cards</TableHead>
              <TableHead className="hidden text-right md:table-cell">Pool</TableHead>
              <TableHead className="text-right">Opened</TableHead>
              <TableHead className="hidden lg:table-cell">Odds</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packs.map((p) => (
              <TableRow key={p.id}>
                <TableCell><Link href={`/admin/packs/${p.id}`} className="font-semibold hover:underline">{p.name}</Link><p className="text-[11px] text-muted-foreground">/{p.slug}</p></TableCell>
                <TableCell className="text-right"><RC amount={p.price} /></TableCell>
                <TableCell className="hidden text-right tabular sm:table-cell">{p.cardsPerPack}</TableCell>
                <TableCell className="hidden text-right tabular md:table-cell">{p._count.pool}</TableCell>
                <TableCell className="text-right tabular">{p._count.openings.toLocaleString()}</TableCell>
                <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{p.oddsVersions[0] ? `v${p.oddsVersions[0].version} · ${formatDate(p.oddsVersions[0].createdAt)}` : "Unpublished"}</TableCell>
                <TableCell className="space-x-1">
                  {p.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  {p.featured && <Badge variant="gold">Featured</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New pack</DialogTitle>
            <DialogDescription>Create the pack, then configure its odds and card pool on the next screen.</DialogDescription>
          </DialogHeader>
          <PackDetailsForm initial={EMPTY_PACK} onSubmit={(v) => create.mutate(v)} pending={create.isPending} submitLabel="Create pack" isNew />
        </DialogContent>
      </Dialog>
    </div>
  );
}
