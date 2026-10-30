import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("size-8", className)}>
      <defs>
        <linearGradient id="rv-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="rv-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="34" height="34" rx="10" fill="url(#rv-mark)" />
      <path d="M11 13 15 10l4 3 4-3 4 3 2-1.5V29a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V13Z" fill="#0b0b12" fillOpacity=".55" />
      <path d="M11 13 15 10l4 3 4-3 4 3 2-1.5" fill="none" stroke="url(#rv-gold)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="20" cy="22" r="4.2" fill="none" stroke="url(#rv-gold)" strokeWidth="2" />
      <circle cx="20" cy="22" r="1.4" fill="url(#rv-gold)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)} aria-label="RipVault home">
      <LogoMark className="transition-transform group-hover:rotate-[-6deg] group-hover:scale-105" />
      <span className="font-display text-lg font-bold tracking-tight">
        Rip<span className="text-gradient-brand">Vault</span>
      </span>
    </Link>
  );
}
