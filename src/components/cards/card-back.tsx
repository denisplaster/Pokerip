import { LogoMark } from "@/components/common/logo";
import { cn } from "@/lib/utils";

/** The face-down side of a RipVault card (original design). */
export function CardBack({ className }: { className?: string }) {
  return (
    <div className={cn("@container relative aspect-[63/88] w-full overflow-hidden rounded-[5%] bg-[#151325] p-[4%] shadow-xl ring-1 ring-white/10", className)}>
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[4%] ring-1 ring-violet-300/20"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, #3b2a7a 0%, #1d1640 45%, #0e0b1f 100%), repeating-conic-gradient(from 0deg, rgba(255,255,255,.03) 0 10deg, transparent 10deg 20deg)",
        }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{ background: "repeating-linear-gradient(45deg, rgba(167,139,250,.12) 0 2px, transparent 2px 12px)" }}
        />
        <div className="absolute size-[78%] rounded-full border border-violet-300/20" />
        <div className="absolute size-[58%] rounded-full border border-cyan-300/20" />
        <LogoMark className="relative size-[38%] drop-shadow-[0_0_18px_rgba(139,92,246,.7)]" />
        <span className="absolute bottom-[7%] font-display text-[7cqw] font-bold uppercase tracking-[0.3em] text-violet-200/70">RipVault</span>
      </div>
    </div>
  );
}
