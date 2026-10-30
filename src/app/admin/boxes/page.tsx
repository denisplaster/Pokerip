import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-ui";
import { RC } from "@/components/common/coin-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listBoxes } from "@/server/services/mystery-boxes";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Mystery boxes" };

export default async function AdminBoxesPage() {
  await requireAdminPage();
  const boxes = await listBoxes({ includeInactive: true });
  return (
    <>
      <AdminHeader title="Mystery boxes" description="Configure box contents and exact odds. Saving publishes a new odds version." actions={<Button asChild><Link href="/admin/boxes/new"><Plus /> New box</Link></Button>} />
      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Box</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Rewards</TableHead>
              <TableHead className="hidden text-right md:table-cell">EV / RTP</TableHead>
              <TableHead className="hidden md:table-cell">Odds</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {boxes.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-semibold">{b.name}<p className="text-[11px] font-normal text-muted-foreground">/{b.slug}</p></TableCell>
                <TableCell className="text-right"><RC amount={b.price} /></TableCell>
                <TableCell className="text-right tabular">{b.rewards.length}</TableCell>
                <TableCell className="hidden text-right text-xs tabular md:table-cell">{b.expectedValue.toLocaleString()} RC · {b.price ? Math.round((b.expectedValue / b.price) * 100) : 0}%</TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">v{b.oddsVersion}</TableCell>
                <TableCell>{b.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" asChild><Link href={`/admin/boxes/${b.id}`}><Pencil /> Edit</Link></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
