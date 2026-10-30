"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { RC } from "@/components/common/coin-icon";
import { PokeCard } from "@/components/cards/poke-card";
import { TiltCard } from "@/components/cards/tilt-card";
import { Button } from "@/components/ui/button";
import { fireConfetti } from "@/lib/confetti";
import type { PulledCard } from "@/server/services/packs";

/** Full-screen celebration for chase-tier pulls. */
export function ChaseCelebration({ pull, onClose }: { pull: PulledCard; onClose: () => void }) {
  useEffect(() => {
    fireConfetti("chase", 1.2);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Chase pull: ${pull.card.name}`}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 overflow-hidden bg-black/85 px-6 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div
        className="absolute left-1/2 top-1/2 size-[160vmax] -translate-x-1/2 -translate-y-1/2 animate-spin-slow opacity-40"
        style={{ background: "repeating-conic-gradient(from 0deg, rgba(251,191,36,.35) 0 6deg, transparent 6deg 18deg)" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(251,113,133,.35),transparent_55%)]" aria-hidden />
      <motion.p
        initial={{ scale: 0.4, opacity: 0, y: -30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
        className="relative font-display text-5xl font-black uppercase tracking-tight sm:text-7xl"
      >
        <span className="text-gradient-gold drop-shadow-[0_0_30px_rgba(245,197,66,.6)]">Chase pull!</span>
      </motion.p>
      <motion.div
        initial={{ scale: 0.2, rotate: -25, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 140, damping: 13, delay: 0.25 }}
        className="relative w-64 sm:w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rainbow-border absolute -inset-1 rounded-[6%] blur-md" />
        <TiltCard max={18}>
          <PokeCard card={pull.card} holo sizes="320px" priority />
        </TiltCard>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="relative space-y-1 text-center">
        <p className="font-display text-2xl font-bold">{pull.card.name}</p>
        <p className="text-sm text-white/70">
          {pull.card.variant ? `${pull.card.variant} · ` : ""}
          {pull.card.set.name} {pull.card.number}
        </p>
        <RC amount={pull.value} className="justify-center text-2xl text-amber-200" />
      </motion.div>
      <Button size="lg" variant="gold" className="relative" onClick={onClose} autoFocus>
        Continue
      </Button>
    </motion.div>
  );
}
