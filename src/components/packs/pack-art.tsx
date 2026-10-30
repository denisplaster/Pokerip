import { cn } from "@/lib/utils";
import { packTheme } from "./pack-themes";

function crimpPath(teeth = 18, depth = 2.2) {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= teeth * 2; i++) {
    const x = (i / (teeth * 2)) * 100;
    top.push(`${x.toFixed(2)}% ${i % 2 ? depth : 0}%`);
    bottom.unshift(`${x.toFixed(2)}% ${i % 2 ? 100 - depth : 100}%`);
  }
  return `polygon(${[...top, ...bottom].join(", ")})`;
}

const CLIP = crimpPath();

/** Foil booster pack artwork (original RipVault design). */
export function PackArt({
  theme,
  name,
  cards,
  className,
  shine = true,
  label = "RipVault",
}: {
  theme: string;
  name: string;
  cards?: number;
  className?: string;
  shine?: boolean;
  label?: string;
}) {
  const t = packTheme(theme);
  const Icon = t.icon;
  return (
    <div className={cn("@container relative aspect-[5/8] w-full select-none", className)} aria-hidden>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          clipPath: CLIP,
          background: `linear-gradient(155deg, ${t.from} 0%, ${t.via} 45%, ${t.to} 100%)`,
          filter: `drop-shadow(0 18px 30px ${t.glow}55)`,
        }}
      >
        {/* foil texture */}
        <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ background: "repeating-linear-gradient(115deg, rgba(255,255,255,.5) 0 1px, transparent 1px 7px)" }} />
        {t.foil === "rainbow" && (
          <div className="absolute inset-0 animate-holo opacity-50 mix-blend-color-dodge" style={{ background: "linear-gradient(120deg, #f472b6, #a78bfa, #22d3ee, #34d399, #facc15, #f472b6)", backgroundSize: "200% 200%" }} />
        )}
        {t.foil === "gold" && <div className="gold-sweep absolute inset-0 opacity-60 mix-blend-overlay" />}
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 45%, rgba(255,255,255,.35), transparent 55%)" }} />

        {/* crimped seals */}
        <div className="absolute inset-x-0 top-0 h-[7%] bg-black/25" style={{ background: "repeating-linear-gradient(90deg, rgba(0,0,0,.28) 0 2px, rgba(255,255,255,.12) 2px 4px)" }} />
        <div className="absolute inset-x-0 bottom-0 h-[7%]" style={{ background: "repeating-linear-gradient(90deg, rgba(0,0,0,.28) 0 2px, rgba(255,255,255,.12) 2px 4px)" }} />

        {/* label */}
        <div className="absolute inset-x-0 top-[10%] flex flex-col items-center gap-[1.5cqw]" style={{ color: t.ink }}>
          <span className="rounded-full bg-black/30 px-[4cqw] py-[1cqw] font-display text-[5.5cqw] font-bold uppercase tracking-[0.35em] backdrop-blur-sm">{label}</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute aspect-square w-[70%] rounded-full border-2 border-white/25" />
          <div className="absolute aspect-square w-[52%] rounded-full bg-white/10 backdrop-blur-[1px]" />
          <Icon className="relative size-[30cqw] text-white" strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 4cqw ${t.glow})` }} />
        </div>
        <div className="absolute inset-x-[8%] bottom-[11%] flex flex-col items-center text-center" style={{ color: t.ink }}>
          <span className="font-display text-[10cqw] font-black uppercase leading-[0.95] drop-shadow-[0_2px_8px_rgba(0,0,0,.45)]">{name.replace(/ Pack$/, "")}</span>
          <span className="mt-[1.5cqw] text-[4.6cqw] font-semibold uppercase tracking-[0.3em] opacity-80">{cards ? `${cards} cards` : "Booster"}</span>
        </div>
        {shine && (
          <div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 animate-shine bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        )}
      </div>
    </div>
  );
}
