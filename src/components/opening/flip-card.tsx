"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CardBack } from "@/components/cards/card-back";
import { PokeCard } from "@/components/cards/poke-card";
import { TiltCard } from "@/components/cards/tilt-card";
import { RARITY_META, type RarityKey } from "@/lib/rarity";
import { cn } from "@/lib/utils";
import type { PulledCard } from "@/server/services/packs";
import { Burst } from "./burst";

const GLOW: Record<RarityKey, string> = {
  COMMON: "0 0 22px rgba(255,255,255,.16)",
  UNCOMMON: "0 0 34px rgba(56,189,248,.55)",
  RARE: "0 0 42px rgba(167,139,250,.65)",
  ULTRA_RARE: "0 0 54px rgba(251,191,36,.75)",
  SECRET_RARE: "0 0 60px rgba(232,121,249,.7)",
  CHASE: "0 0 80px rgba(251,113,133,.85)",
};

const PARTICLES: Partial<Record<RarityKey, { colors: string[]; count: number }>> = {
  RARE: { colors: ["#a78bfa", "#c4b5fd", "#7c3aed"], count: 18 },
  ULTRA_RARE: { colors: ["#fde68a", "#f5c542", "#f59e0b"], count: 26 },
  SECRET_RARE: { colors: ["#f472b6", "#a78bfa", "#22d3ee", "#34d399", "#facc15"], count: 34 },
  CHASE: { colors: ["#fb7185", "#f59e0b", "#fde68a", "#ffffff"], count: 44 },
};

/** A face-down card that flips in 3D and plays its rarity effect when revealed. */
export function FlipCard({
  pull,
  revealed,
  onReveal,
  index,
  total,
  compact,
}: {
  pull: PulledCard;
  revealed: boolean;
  onReveal: () => void;
  index: number;
  total: number;
  compact?: boolean;
}) {
  const r = pull.rarity;
  const particles = PARTICLES[r];
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.8, rotate: -6 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      transition={{ delay: index * (compact ? 0.03 : 0.09), type: "spring", stiffness: 260, damping: 22 }}
      className="relative"
    >
      <button
        type="button"
        onClick={onReveal}
        disabled={revealed}
        aria-label={revealed ? `${pull.card.name}, ${RARITY_META[r].label}` : `Reveal card ${index + 1} of ${total}`}
        className={cn("perspective group block w-full rounded-[6%] outline-none focus-visible:ring-4 focus-visible:ring-ring/60", !revealed && "cursor-pointer")}
      >
        <motion.div
          className="preserve-3d relative"
          animate={{ rotateY: revealed ? 180 : 0 }}
          transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
          whileHover={revealed ? undefined : { y: -6, rotateZ: 1.5 }}
        >
          <div className="backface-hidden">
            <CardBack className={cn("transition-shadow", !revealed && "group-hover:shadow-[0_0_30px_rgba(139,92,246,.45)]")} />
          </div>
          <div className="backface-hidden absolute inset-0 [transform:rotateY(180deg)]">
            {(r === "SECRET_RARE" || r === "CHASE") && revealed && <div className="rainbow-border absolute -inset-[3px] rounded-[6%] opacity-90 blur-[2px]" />}
            <div className="relative rounded-[5%] transition-shadow duration-700" style={{ boxShadow: revealed ? GLOW[r] : "none" }}>
              <TiltCard max={compact ? 6 : 12}>
                <PokeCard card={pull.card} sizes={compact ? "140px" : "240px"} />
              </TiltCard>
              {r === "ULTRA_RARE" && revealed && <div className="gold-sweep pointer-events-none absolute inset-0 rounded-[5%] mix-blend-overlay" />}
              {pull.isNew && revealed && (
                <span className="absolute -left-1.5 -top-1.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-950 shadow-lg">New</span>
              )}
            </div>
          </div>
        </motion.div>
      </button>
      <AnimatePresence>{revealed && particles && <Burst key="burst" colors={particles.colors} count={compact ? Math.round(particles.count / 2) : particles.count} distance={compact ? 90 : 160} />}</AnimatePresence>
      {!compact && (
        <motion.div initial={false} animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 6 }} className="mt-2 text-center">
          <p className={cn("truncate text-sm font-semibold", RARITY_META[r].text)}>{pull.card.name}</p>
          <p className="text-xs text-amber-200/90 tabular">{pull.value.toLocaleString()} RC</p>
        </motion.div>
      )}
    </motion.div>
  );
}
