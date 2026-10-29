import { Crown, Diamond, Flame, Gem, PawPrint, Sparkle, Star, type LucideIcon } from "lucide-react";

export interface PackTheme {
  from: string;
  via: string;
  to: string;
  ink: string;
  glow: string;
  icon: LucideIcon;
  foil?: "rainbow" | "gold";
}

export const PACK_THEMES: Record<string, PackTheme> = {
  starter: { from: "#0e7490", via: "#22d3ee", to: "#155e75", ink: "#ecfeff", glow: "#22d3ee", icon: Sparkle },
  trainer: { from: "#3730a3", via: "#8b5cf6", to: "#312e81", ink: "#ede9fe", glow: "#8b5cf6", icon: Star },
  eevee: { from: "#92400e", via: "#fbbf24", to: "#78350f", ink: "#fffbeb", glow: "#f59e0b", icon: PawPrint },
  ultra: { from: "#701a75", via: "#d946ef", to: "#4c1d95", ink: "#fdf4ff", glow: "#d946ef", icon: Gem },
  inferno: { from: "#9a3412", via: "#f97316", to: "#7f1d1d", ink: "#fff7ed", glow: "#f97316", icon: Flame },
  legendary: { from: "#92400e", via: "#fcd34d", to: "#78350f", ink: "#fffbeb", glow: "#fbbf24", icon: Crown, foil: "gold" },
  master: { from: "#09090b", via: "#4c1d95", to: "#0c0a09", ink: "#faf5ff", glow: "#a78bfa", icon: Diamond, foil: "rainbow" },
};

export function packTheme(key: string): PackTheme {
  return PACK_THEMES[key] ?? PACK_THEMES.trainer;
}
