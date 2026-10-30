/** XP & level curve. Cumulative XP to reach level L is 50·L·(L−1). */
export const MAX_LEVEL = 100;

export function xpForLevel(level: number) {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 50 * l * (l - 1);
}

export function levelForXp(xp: number) {
  // Solve 50·L·(L−1) <= xp for the largest integer L.
  const l = Math.floor((1 + Math.sqrt(1 + (4 * Math.max(0, xp)) / 50)) / 2);
  return Math.max(1, Math.min(MAX_LEVEL, l));
}

export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const current = xpForLevel(level);
  const next = level >= MAX_LEVEL ? current : xpForLevel(level + 1);
  const span = Math.max(1, next - current);
  return {
    level,
    xpIntoLevel: xp - current,
    xpForNext: next - current,
    progress: level >= MAX_LEVEL ? 1 : Math.min(1, (xp - current) / span),
    isMax: level >= MAX_LEVEL,
  };
}

/** XP granted for opening one pack, scaled sub-linearly with its price. */
export function xpForPack(price: number) {
  return 10 + Math.floor(Math.sqrt(Math.max(0, price)));
}

/** Rip Coins granted when reaching `level`. */
export function levelUpReward(level: number, base = 100, perLevel = 50) {
  const milestone = level % 10 === 0 ? 1000 : 0;
  return base + perLevel * level + milestone;
}
