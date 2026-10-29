"use client";

import { Gift, Menu, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/common/logo";
import { UserAvatar } from "@/components/common/user-avatar";
import { useUser } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";
import { UserMenu } from "./user-menu";
import { WalletPill } from "./wallet-pill";

export function SiteHeader() {
  const user = useUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data: wallet } = useWallet(Boolean(user));
  const links = NAV_ITEMS.filter((n) => n.href !== "/");

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="ml-2 hidden items-center gap-0.5 xl:flex">
          {links.map((item) => {
            if (item.auth && !user) return null;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                <span className="2xl:hidden">{item.short}</span>
                <span className="hidden 2xl:inline">{item.label}</span>
                {active && <span className="absolute inset-x-2.5 -bottom-[13px] h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />}
              </Link>
            );
          })}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className={cn(
                "ml-1 flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-amber-300/80 transition-colors hover:text-amber-200",
                isActive(pathname, "/admin") && "text-amber-200",
              )}
            >
              <ShieldCheck className="size-4" /> Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/rewards"
                    className="relative hidden size-10 items-center justify-center rounded-xl border border-white/[0.08] text-muted-foreground transition-colors hover:text-foreground sm:flex"
                    aria-label={wallet?.dailyClaimable ? "Daily reward ready to claim" : "Daily rewards"}
                  >
                    <Gift className="size-5" />
                    {wallet?.dailyClaimable && (
                      <span className="absolute -right-0.5 -top-0.5 flex size-3">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex size-3 rounded-full bg-amber-400" />
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{wallet?.dailyClaimable ? "Your daily reward is ready!" : "Daily rewards & missions"}</TooltipContent>
              </Tooltip>
              <WalletPill />
              <div className="hidden sm:block">
                <UserMenu user={user} />
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}>Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get 10,000 RC free</Link>
              </Button>
            </>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0">
              <SheetHeader className="border-b">
                <SheetTitle>
                  {user ? (
                    <span className="flex items-center gap-3">
                      <UserAvatar avatar={user.avatar} image={user.image} username={user.username} className="size-10" />
                      <span className="flex flex-col">
                        <span>{user.username}</span>
                        <span className="text-xs font-normal text-muted-foreground">Level {user.level}</span>
                      </span>
                    </span>
                  ) : (
                    "Menu"
                  )}
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 px-3">
                {[...NAV_ITEMS, ...(user ? [{ href: "/profile", label: "Profile", short: "Profile", icon: UserRound }] : [])].map((item) => {
                  if ("auth" in item && item.auth && !user) return null;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground",
                        isActive(pathname, item.href) && "bg-white/[0.06] text-foreground",
                      )}
                    >
                      <Icon className="size-5" />
                      {item.label}
                    </Link>
                  );
                })}
                {user?.role === "ADMIN" && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-amber-300">
                    <ShieldCheck className="size-5" /> Admin
                  </Link>
                )}
                {user ? (
                  <>
                    <Link href="/settings" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 pl-11 text-sm text-muted-foreground hover:text-foreground">
                      Settings
                    </Link>
                    <div className="px-3 py-2">
                      <UserMenu user={user} />
                    </div>
                  </>
                ) : (
                  <div className="mt-4 grid gap-2 px-3">
                    <Button asChild>
                      <Link href="/register" onClick={() => setOpen(false)}>Create account</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>
                    </Button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
