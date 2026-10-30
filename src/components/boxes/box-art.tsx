import { cn } from "@/lib/utils";

const THEMES: Record<string, { a: string; b: string; ribbon: string; glow: string }> = {
  cyan: { a: "#0e7490", b: "#22d3ee", ribbon: "#fde68a", glow: "#22d3ee" },
  purple: { a: "#4c1d95", b: "#a78bfa", ribbon: "#f5c542", glow: "#8b5cf6" },
  gold: { a: "#78350f", b: "#fbbf24", ribbon: "#fef3c7", glow: "#f59e0b" },
  rose: { a: "#881337", b: "#fb7185", ribbon: "#fde68a", glow: "#fb7185" },
};

/** Mystery box illustration with lid, ribbon and a glowing question mark. */
export function BoxArt({ theme, className, open = false }: { theme: string; className?: string; open?: boolean }) {
  const t = THEMES[theme] ?? THEMES.purple;
  return (
    <div className={cn("@container relative aspect-square w-full select-none", className)} aria-hidden>
      <div className="absolute inset-x-[12%] bottom-[6%] h-[8%] rounded-[50%] blur-md" style={{ background: `${t.glow}55` }} />
      {/* body */}
      <div
        className="absolute inset-x-[14%] bottom-[10%] top-[38%] overflow-hidden rounded-[6cqw] shadow-2xl"
        style={{ background: `linear-gradient(160deg, ${t.b}, ${t.a})`, boxShadow: `0 20px 50px -15px ${t.glow}aa, inset 0 2px 0 rgba(255,255,255,.35)` }}
      >
        <div className="absolute inset-0 opacity-25 mix-blend-overlay" style={{ background: "repeating-linear-gradient(135deg, rgba(255,255,255,.6) 0 2px, transparent 2px 10px)" }} />
        <div className="absolute inset-y-0 left-1/2 w-[14%] -translate-x-1/2" style={{ background: t.ribbon, boxShadow: "inset 0 0 6px rgba(0,0,0,.25)" }} />
        <span className="absolute inset-0 flex items-center justify-center font-display text-[26cqw] font-black text-white/90 drop-shadow-[0_0_4cqw_rgba(255,255,255,.6)]">?</span>
      </div>
      {/* lid */}
      <div
        className={cn("absolute inset-x-[10%] top-[28%] h-[14%] rounded-[4cqw] transition-transform duration-700", open && "-translate-y-[60%] rotate-[-14deg]")}
        style={{ background: `linear-gradient(180deg, ${t.b}, ${t.a})`, boxShadow: "inset 0 2px 0 rgba(255,255,255,.4), 0 6px 14px rgba(0,0,0,.35)" }}
      >
        <div className="absolute inset-y-0 left-1/2 w-[14%] -translate-x-1/2" style={{ background: t.ribbon }} />
        <div className="absolute -top-[95%] left-1/2 flex -translate-x-1/2 gap-[1cqw]">
          <span className="block h-[9cqw] w-[13cqw] -rotate-[25deg] rounded-[50%] border-[2.2cqw]" style={{ borderColor: t.ribbon }} />
          <span className="block h-[9cqw] w-[13cqw] rotate-[25deg] rounded-[50%] border-[2.2cqw]" style={{ borderColor: t.ribbon }} />
        </div>
      </div>
    </div>
  );
}
