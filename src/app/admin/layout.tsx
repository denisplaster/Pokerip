import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdminPage } from "@/server/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · RipVault" } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-6 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-amber-300">
        <ShieldCheck className="size-4" /> Admin dashboard
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <AdminNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
