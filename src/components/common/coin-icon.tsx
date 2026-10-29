import { cn } from "@/lib/utils";

/** Rip Coin glyph — an original mark, not a real currency symbol. */
export function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4 shrink-0", className)}>
      <defs>
        <linearGradient id="rc-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#f5c542" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" fill="url(#rc-coin)" stroke="#92400e" strokeOpacity=".45" />
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="#fff7d6" strokeOpacity=".55" strokeWidth="1" />
      <path d="M9 7.5h3.6a2.6 2.6 0 0 1 .5 5.15L15.4 16.5h-2.1l-2.1-3.7H10.9v3.7H9V7.5Zm1.9 1.6v2.3h1.6a1.15 1.15 0 0 0 0-2.3h-1.6Z" fill="#7c2d12" fillOpacity=".85" />
    </svg>
  );
}

export function RC({ amount, className, compact }: { amount: number; className?: string; compact?: boolean }) {
  const text = compact && Math.abs(amount) >= 10_000
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(amount)
    : amount.toLocaleString("en-US");
  return (
    <span className={cn("inline-flex items-center gap-1 tabular font-semibold", className)}>
      <CoinIcon className="size-[1.05em]" />
      {text}
      <span className="sr-only"> Rip Coins</span>
    </span>
  );
}
