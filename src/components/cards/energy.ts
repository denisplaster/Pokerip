import { Droplet, Eye, Flame, Gem, Hand, Leaf, Moon, Shield, Sparkles, Star, Wrench, Zap, type LucideIcon } from "lucide-react";

export interface EnergyMeta {
  label: string;
  icon: LucideIcon;
  from: string;
  to: string;
  ink: string;
}

export const ENERGY: Record<string, EnergyMeta> = {
  grass: { label: "Grass", icon: Leaf, from: "#4ade80", to: "#166534", ink: "#052e16" },
  fire: { label: "Fire", icon: Flame, from: "#fb923c", to: "#b91c1c", ink: "#450a0a" },
  water: { label: "Water", icon: Droplet, from: "#38bdf8", to: "#1e40af", ink: "#082f49" },
  lightning: { label: "Lightning", icon: Zap, from: "#fde047", to: "#ca8a04", ink: "#422006" },
  psychic: { label: "Psychic", icon: Eye, from: "#d8b4fe", to: "#7e22ce", ink: "#3b0764" },
  fighting: { label: "Fighting", icon: Hand, from: "#fbbf24", to: "#9a3412", ink: "#431407" },
  colorless: { label: "Colorless", icon: Star, from: "#f4f4f5", to: "#a1a1aa", ink: "#27272a" },
  dark: { label: "Darkness", icon: Moon, from: "#64748b", to: "#0f172a", ink: "#020617" },
  metal: { label: "Metal", icon: Shield, from: "#cbd5e1", to: "#475569", ink: "#0f172a" },
  dragon: { label: "Dragon", icon: Gem, from: "#facc15", to: "#15803d", ink: "#052e16" },
  fairy: { label: "Fairy", icon: Sparkles, from: "#f9a8d4", to: "#be185d", ink: "#500724" },
  trainer: { label: "Trainer", icon: Wrench, from: "#d6d3d1", to: "#57534e", ink: "#1c1917" },
};

export function energyMeta(type: string): EnergyMeta {
  return ENERGY[type] ?? ENERGY.colorless;
}
