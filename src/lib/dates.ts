/** All progression resets happen at 00:00 UTC. */
export function utcDateKey(date: Date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function startOfUtcDay(date: Date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function nextUtcMidnight(date: Date = new Date()) {
  return addUtcDays(startOfUtcDay(date), 1);
}

/** ISO-8601 week key, e.g. "2026-W05". Weeks start on Monday. */
export function isoWeekKey(date: Date = new Date()) {
  const d = startOfUtcDay(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function startOfIsoWeek(date: Date = new Date()) {
  const d = startOfUtcDay(date);
  const day = d.getUTCDay() || 7;
  return addUtcDays(d, 1 - day);
}

export type MissionPeriodKey = "DAILY" | "WEEKLY" | "ONCE";

export function periodKey(period: MissionPeriodKey, date: Date = new Date()) {
  switch (period) {
    case "DAILY":
      return `D:${utcDateKey(date)}`;
    case "WEEKLY":
      return `W:${isoWeekKey(date)}`;
    case "ONCE":
      return "ONCE";
  }
}

export function periodResetsAt(period: MissionPeriodKey, date: Date = new Date()) {
  if (period === "DAILY") return nextUtcMidnight(date);
  if (period === "WEEKLY") return addUtcDays(startOfIsoWeek(date), 7);
  return null;
}

export type LeaderboardPeriod = "day" | "week" | "month" | "all";

export function periodStart(period: LeaderboardPeriod, now: Date = new Date()): Date | null {
  switch (period) {
    case "day":
      return new Date(now.getTime() - 86_400_000);
    case "week":
      return new Date(now.getTime() - 7 * 86_400_000);
    case "month":
      return new Date(now.getTime() - 30 * 86_400_000);
    default:
      return null;
  }
}
