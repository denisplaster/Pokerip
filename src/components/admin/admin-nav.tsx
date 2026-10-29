"use client";

import { Activity, Boxes, Dices, Gift, LayoutDashboard, Layers, PackageOpen, Receipt, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/packs", label: "Packs & odds", icon: PackageOpen },
  { href: "/admin/cards", label: "Cards & prices", icon: Layers },
  { href: "/admin/boxes", label: "Mystery boxes", icon: Boxes },
  { href: "/admin/transactions", label: "Transactions", icon: Receipt },
  { href: "/admin/simulator", label: "Pack simulator", icon: Dices },
  { href: "/admin/rewards", label: "Daily rewards & missions", icon: Gift },
  { href: "/admin/settings", label: "Economy & audit", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto pb-2 scrollbar-none lg:flex-col lg:overflow-visible lg:pb-0">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground",
              active && "bg-white/[0.07] text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
      <p className="mt-4 hidden items-center gap-2 px-3 text-[11px] text-muted-foreground lg:flex">
        <Activity className="size-3.5" /> All changes are audit-logged.
      </p>
    </nav>
  );
}
