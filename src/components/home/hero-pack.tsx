"use client";

import { motion } from "framer-motion";
import { PokeCard, type CardFaceData } from "@/components/cards/poke-card";
import { TiltCard } from "@/components/cards/tilt-card";
import { PackArt } from "@/components/packs/pack-art";
import { packTheme } from "@/components/packs/pack-themes";

/** Animated featured pack with its chase cards fanned behind it. */
export function HeroPack({ theme, name, cards, chase }: { theme: string; name: string; cards: number; chase: CardFaceData[] }) {
  const t = packTheme(theme);
  const positions = [
    { x: -150, y: 30, r: -16 },
    { x: 150, y: 30, r: 16 },
    { x: 0, y: -40, r: 0 },
  ];
  return (
    <div className="relative mx-auto flex h-[380px] w-full max-w-[460px] items-center justify-center sm:h-[460px]">
      <div className="absolute size-[320px] rounded-full opacity-60 blur-3xl sm:size-[400px]" style={{ background: `radial-gradient(circle, ${t.glow}, transparent 65%)` }} aria-hidden />
      <div className="absolute size-[300px] animate-spin-slow rounded-full border border-dashed border-white/10 sm:size-[380px]" aria-hidden />
      {chase.slice(0, 3).map((card, i) => (
        <motion.div
          key={i}
          className="absolute w-[110px] sm:w-[140px]"
          initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.6 }}
          animate={{ opacity: i === 2 ? 0.55 : 0.9, x: positions[i].x * (i === 2 ? 0 : 1), y: positions[i].y, rotate: positions[i].r, scale: 1 }}
          transition={{ delay: 0.3 + i * 0.12, type: "spring", stiffness: 120, damping: 14 }}
          aria-hidden
        >
          <PokeCard card={card} sizes="140px" />
        </motion.div>
      ))}
      <motion.div className="relative w-[190px] sm:w-[230px]" initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 110, damping: 14 }}>
        <TiltCard max={12}>
          <div className="animate-float">
            <PackArt theme={theme} name={name} cards={cards} />
          </div>
        </TiltCard>
      </motion.div>
    </div>
  );
}
