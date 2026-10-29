"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/components/providers";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";

const TABS = ["/", "/packs", "/collection", "/marketplace", "/rewards"];

/** App-style bottom navigation on small screens. */
export function MobileTabBar() {
  const pathname = usePathname();
  const user = useUser();
  if (pathname.startsWith("/open/")) return null;
  const items = NAV_ITEMS.filter((n) => TABS.includes(n.href) && (!n.auth || user));
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground", active && "text-foreground")}
              >
                <Icon className={cn("size-5", active && "text-violet-300")} />
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
