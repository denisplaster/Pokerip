"use client";

import confetti from "canvas-confetti";

const PALETTES = {
  secret: ["#f472b6", "#a78bfa", "#22d3ee", "#34d399", "#facc15"],
  chase: ["#fb7185", "#f59e0b", "#fde68a", "#a78bfa", "#ffffff"],
  gold: ["#fde68a", "#f5c542", "#f59e0b", "#ffffff"],
};

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function fireConfetti(kind: keyof typeof PALETTES, intensity = 1) {
  if (reducedMotion()) return;
  const colors = PALETTES[kind];
  const base = { colors, ticks: 220, disableForReducedMotion: true, zIndex: 80 };
  confetti({ ...base, particleCount: Math.round(90 * intensity), spread: 75, startVelocity: 48, origin: { x: 0.5, y: 0.6 } });
  if (intensity >= 1) {
    setTimeout(() => confetti({ ...base, particleCount: Math.round(60 * intensity), angle: 60, spread: 60, origin: { x: 0, y: 0.75 } }), 180);
    setTimeout(() => confetti({ ...base, particleCount: Math.round(60 * intensity), angle: 120, spread: 60, origin: { x: 1, y: 0.75 } }), 300);
  }
  if (kind === "chase") {
    setTimeout(() => confetti({ ...base, particleCount: 160, spread: 120, startVelocity: 60, scalar: 1.2, origin: { x: 0.5, y: 0.45 } }), 650);
  }
}
