import { AdminTransactions } from "@/components/admin/admin-transactions";
import { AdminHeader } from "@/components/admin/admin-ui";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Transactions" };

export default async function AdminTransactionsPage() {
  await requireAdminPage();
  return (
    <>
      <AdminHeader title="Transaction ledger" description="Every Rip Coin movement, immutable and append-only, with balance before and after." />
      <AdminTransactions />
    </>
  );
}
