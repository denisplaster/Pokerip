import { AdminHeader } from "@/components/admin/admin-ui";
import { AdminUsers } from "@/components/admin/admin-users";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  await requireAdminPage();
  return (
    <>
      <AdminHeader title="Users" description="Search collectors, review their ledger, adjust balances with an audit trail, and manage roles or suspensions." />
      <AdminUsers />
    </>
  );
}
