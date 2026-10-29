import { CalendarCheck, Gift, House, Library, PackageOpen, Store, Trophy, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  auth?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", short: "Home", icon: House },
  { href: "/packs", label: "Open Packs", short: "Packs", icon: PackageOpen },
  { href: "/mystery-boxes", label: "Mystery Boxes", short: "Boxes", icon: Gift },
  { href: "/marketplace", label: "Marketplace", short: "Market", icon: Store },
  { href: "/collection", label: "My Collection", short: "Collection", icon: Library, auth: true },
  { href: "/leaderboards", label: "Leaderboards", short: "Leaderboards", icon: Trophy },
  { href: "/rewards", label: "Daily Rewards", short: "Rewards", icon: CalendarCheck, auth: true },
];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`) || (href === "/packs" && pathname.startsWith("/open/"));
}
