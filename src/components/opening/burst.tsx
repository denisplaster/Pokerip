"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

/** Deterministic pseudo-random in [0, 1) so rendering stays pure. */
function noise(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Radial particle burst used when cards are revealed and packs are torn. */
export function Burst({ colors, count = 20, distance = 140, size = 6, duration = 0.9 }: { colors: string[]; count?: number; distance?: number; size?: number; duration?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + noise(i, 1) * 0.5;
        const d = distance * (0.55 + noise(i, 2) * 0.6);
        return { x: Math.cos(angle) * d, y: Math.sin(angle) * d, s: size * (0.5 + noise(i, 3)), c: colors[i % colors.length], delay: noise(i, 4) * 0.08 };
      }),
    [count, distance, size, colors],
  );
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ width: p.s, height: p.s, background: p.c, boxShadow: `0 0 ${p.s * 2}px ${p.c}` }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
          transition={{ duration, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
