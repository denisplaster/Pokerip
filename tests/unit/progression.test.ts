import { describe, expect, it } from "vitest";
import { addUtcDays, isoWeekKey, periodKey, periodResetsAt, utcDateKey } from "@/lib/dates";
import { levelForXp, levelProgress, levelUpReward, MAX_LEVEL, xpForLevel, xpForPack } from "@/lib/levels";
import { cycleDay, nextStreak } from "@/lib/streak";

describe("levels", () => {
  it("is consistent between xpForLevel and levelForXp", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const xp = xpForLevel(level);
      expect(levelForXp(xp)).toBe(level);
      if (level > 1) expect(levelForXp(xp - 1)).toBe(level - 1);
    }
  });

  it("caps at the max level and reports progress", () => {
    expect(levelForXp(10 ** 9)).toBe(MAX_LEVEL);
    const p = levelProgress(xpForLevel(5) + 50);
    expect(p.level).toBe(5);
    expect(p.xpIntoLevel).toBe(50);
    expect(p.progress).toBeGreaterThan(0);
    expect(p.progress).toBeLessThan(1);
  });

  it("scales pack XP sub-linearly and rewards milestones", () => {
    expect(xpForPack(100)).toBe(20);
    expect(xpForPack(10_000)).toBe(110);
    expect(levelUpReward(10)).toBeGreaterThan(levelUpReward(9) + 1000 - 1);
  });
});

describe("daily streaks", () => {
  const now = new Date("2026-03-10T15:00:00Z");

  it("starts at day 1", () => {
    expect(nextStreak(null, 0, now)).toEqual({ claimedToday: false, streak: 1 });
  });

  it("continues when the last claim was yesterday (UTC)", () => {
    expect(nextStreak(new Date("2026-03-09T23:59:00Z"), 4, now)).toEqual({ claimedToday: false, streak: 5 });
  });

  it("blocks a second claim on the same UTC day", () => {
    expect(nextStreak(new Date("2026-03-10T00:00:01Z"), 4, now)).toEqual({ claimedToday: true, streak: 4 });
  });

  it("resets after a missed day", () => {
    expect(nextStreak(new Date("2026-03-08T12:00:00Z"), 6, now)).toEqual({ claimedToday: false, streak: 1 });
  });

  it("cycles through a 7-day reward calendar", () => {
    expect([1, 2, 6, 7, 8, 14, 15].map(cycleDay)).toEqual([1, 2, 6, 7, 1, 7, 1]);
  });
});

describe("period keys", () => {
  it("uses UTC days and ISO weeks", () => {
    const d = new Date("2026-01-01T10:00:00Z"); // Thursday → ISO week 2026-W01
    expect(utcDateKey(d)).toBe("2026-01-01");
    expect(isoWeekKey(d)).toBe("2026-W01");
    expect(isoWeekKey(new Date("2025-12-29T00:00:00Z"))).toBe("2026-W01");
    expect(periodKey("DAILY", d)).toBe("D:2026-01-01");
    expect(periodKey("WEEKLY", d)).toBe("W:2026-W01");
    expect(periodKey("ONCE", d)).toBe("ONCE");
  });

  it("computes reset times", () => {
    const d = new Date("2026-01-01T10:00:00Z");
    expect(periodResetsAt("DAILY", d)?.toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(periodResetsAt("WEEKLY", d)?.toISOString()).toBe("2026-01-05T00:00:00.000Z");
    expect(periodResetsAt("ONCE", d)).toBeNull();
    expect(utcDateKey(addUtcDays(d, -1))).toBe("2025-12-31");
  });
});
