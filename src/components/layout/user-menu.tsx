"use client";

import { LogOut, Settings, ShieldCheck, UserRound, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { UserAvatar } from "@/components/common/user-avatar";
import type { ClientUser } from "@/components/providers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWallet } from "@/hooks/use-wallet";
import { usePreferences } from "@/stores/preferences";

export function UserMenu({ user }: { user: ClientUser }) {
  const { muted, toggleMuted } = usePreferences();
  const { data: wallet } = useWallet();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl p-1 outline-none ring-ring/50 transition-colors hover:bg-white/[0.06] focus-visible:ring-[3px]" aria-label="Account menu">
        <UserAvatar avatar={user.avatar} image={user.image} username={user.username} className="size-8" />
        <span className="hidden flex-col items-start leading-tight 2xl:flex">
          <span className="max-w-28 truncate text-sm font-semibold">{user.username}</span>
          <span className="text-[11px] text-muted-foreground">Level {wallet?.level ?? user.level}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Signed in as {user.username}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        {user.role === "ADMIN" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck /> Admin dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleMuted(); }}>
          {muted ? <VolumeX /> : <Volume2 />} {muted ? "Unmute sounds" : "Mute sounds"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => signOut({ redirectTo: "/" })}>
          <LogOut className="!text-red-300" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
