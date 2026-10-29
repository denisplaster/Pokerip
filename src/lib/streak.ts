import { addUtcDays, utcDateKey } from "./dates";

/** Day in the 7-day reward cycle for a given streak length (1-based). */
export function cycleDay(streak: number) {
  return ((Math.max(1, streak) - 1) % 7) + 1;
}

/**
 * The streak a user will have if they claim at `now`: claiming on the UTC day
 * after the previous claim continues the streak; any gap resets it to 1.
 */
export function nextStreak(lastClaimAt: Date | null, currentStreak: number, now: Date) {
  if (!lastClaimAt) return { claimedToday: false, streak: 1 };
  const today = utcDateKey(now);
  const last = utcDateKey(lastClaimAt);
  if (last === today) return { claimedToday: true, streak: currentStreak };
  if (last === utcDateKey(addUtcDays(now, -1))) return { claimedToday: false, streak: currentStreak + 1 };
  return { claimedToday: false, streak: 1 };
}
