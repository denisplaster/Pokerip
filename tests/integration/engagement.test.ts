import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { listActivity } from "@/server/services/activity";
import { claimDailyReward, getDailyStatus } from "@/server/services/daily";
import { getLeaderboard } from "@/server/services/leaderboards";
import { claimMission, getMissions } from "@/server/services/missions";
import { openBox } from "@/server/services/mystery-boxes";
import { openPacks } from "@/server/services/packs";
import { getProfile, updateProfile } from "@/server/services/profiles";
import { assertLedgerConsistent, balanceOf, createUser, giveCard, seedFixture, type Fixture } from "./fixtures";

let fx: Fixture;
beforeEach(async () => {
  fx = await seedFixture();
});

const key = () => `k${Math.random().toString(36).slice(2, 14)}`;
const day = (iso: string) => new Date(iso);

describe("daily rewards", () => {
  it("pays day 1, blocks a second claim the same UTC day, and continues the streak tomorrow", async () => {
    const user = await createUser({ balance: 0 });
    const first = await claimDailyReward(user.id, day("2026-05-01T09:00:00Z"));
    expect(first).toMatchObject({ day: 1, streak: 1, coins: 100 });
    await expect(claimDailyReward(user.id, day("2026-05-01T23:59:00Z"))).rejects.toMatchObject({ code: "CONFLICT" });
    const second = await claimDailyReward(user.id, day("2026-05-02T00:01:00Z"));
    expect(second).toMatchObject({ day: 2, streak: 2, coins: 150 });
    const status = await getDailyStatus(user.id, day("2026-05-02T12:00:00Z"));
    expect(status).toMatchObject({ claimedToday: true, streak: 2, nextDay: 3 });
    await assertLedgerConsistent(user.id);
  });

  it("resets the streak after a missed day", async () => {
    const user = await createUser();
    await claimDailyReward(user.id, day("2026-05-01T09:00:00Z"));
    await claimDailyReward(user.id, day("2026-05-02T09:00:00Z"));
    const res = await claimDailyReward(user.id, day("2026-05-04T09:00:00Z"));
    expect(res).toMatchObject({ day: 1, streak: 1 });
  });

  it("allows only one claim when requests race", async () => {
    const user = await createUser({ balance: 0 });
    const now = day("2026-06-10T10:00:00Z");
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => claimDailyReward(user.id, now)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.dailyRewardClaim.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.walletTransaction.count({ where: { userId: user.id, type: "DAILY_REWARD" } })).toBe(1);
  });

  it("grants a free pack voucher on day 7 that can be redeemed", async () => {
    const user = await createUser({ balance: 0 });
    for (let d = 1; d <= 7; d++) await claimDailyReward(user.id, day(`2026-07-0${d}T08:00:00Z`));
    const voucher = await prisma.packVoucher.findFirstOrThrow({ where: { userId: user.id } });
    expect(voucher.packId).toBe(fx.packId);
    const opened = await openPacks({ userId: user.id, pack: fx.packId, quantity: 1, idempotencyKey: key(), useVoucher: true });
    expect(opened.totalPaid).toBe(0);
    const streakBadge = await prisma.userAchievement.findFirst({ where: { userId: user.id, achievement: { key: "streak-7" } } });
    expect(streakBadge).not.toBeNull();
  });
});

describe("missions", () => {
  it("can be claimed exactly once after completion", async () => {
    const user = await createUser({ balance: 1_000 });
    await openPacks({ userId: user.id, pack: "test-pack", quantity: 5, idempotencyKey: key() });
    const mission = (await getMissions(user.id)).find((m) => m.key === "daily-open-3")!;
    expect(mission).toMatchObject({ completed: true, claimed: false, progress: 3 });
    const before = await balanceOf(user.id);
    const results = await Promise.allSettled([claimMission(user.id, mission.id), claimMission(user.id, mission.id), claimMission(user.id, mission.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await balanceOf(user.id)).toBeGreaterThanOrEqual(before + 300);
    expect(await prisma.walletTransaction.count({ where: { userId: user.id, type: "MISSION_REWARD" } })).toBe(1);
    await assertLedgerConsistent(user.id);
  });

  it("refuses to pay incomplete missions", async () => {
    const user = await createUser();
    const mission = (await getMissions(user.id)).find((m) => m.key === "weekly-open-25")!;
    await expect(claimMission(user.id, mission.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("tracks set completion as a one-off milestone", async () => {
    const user = await createUser({ balance: 0 });
    const mini = fx.cards.filter((c) => c.setId === fx.setIds[1]);
    // Acquire both mini-set cards through the marketplace flow so completion bookkeeping runs.
    const seller = await createUser();
    const { createListing, buyListing } = await import("@/server/services/marketplace");
    await prisma.wallet.update({ where: { userId: user.id }, data: { balance: 100 } });
    await prisma.walletTransaction.create({ data: { walletId: (await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } })).id, userId: user.id, type: "ADMIN_ADJUSTMENT", amount: 100, balanceBefore: 0, balanceAfter: 100, description: "test" } });
    for (const c of mini) {
      const copy = await giveCard(seller.id, c.id);
      const { listing } = await createListing(seller.id, copy.id, 5);
      await buyListing(user.id, listing.id);
    }
    const mission = (await getMissions(user.id)).find((m) => m.key === "once-complete-set")!;
    expect(mission.completed).toBe(true);
    expect(await prisma.activityEvent.count({ where: { userId: user.id, type: "SET_COMPLETED" } })).toBe(1);
  });
});

describe("mystery boxes", () => {
  it("mints limited collectibles with unique serials and falls back to coins once sold out", async () => {
    // Supply is 2 in the fixture.
    const users = await Promise.all([createUser({ balance: 1_000 }), createUser({ balance: 1_000 }), createUser({ balance: 1_000 })]);
    const results = await Promise.all(users.map((u) => openBox({ userId: u.id, box: "test-box", idempotencyKey: key() })));
    const serials = results.map((r) => r.awarded.collectible?.serialNumber).filter(Boolean).sort();
    expect(serials).toEqual([1, 2]);
    const fallback = results.find((r) => r.awarded.usedFallback)!;
    expect(fallback.awarded.coins).toBe(150);
    const collectible = await prisma.collectible.findUniqueOrThrow({ where: { id: fx.collectibleId } });
    expect(collectible.mintedCount).toBe(2);
    for (const u of users) await assertLedgerConsistent(u.id);
  });

  it("is idempotent and charges the box price once", async () => {
    const user = await createUser({ balance: 1_000 });
    const k = key();
    const a = await openBox({ userId: user.id, box: "test-box", idempotencyKey: k });
    const b = await openBox({ userId: user.id, box: "test-box", idempotencyKey: k });
    expect(b.replayed).toBe(true);
    expect(b.openingId).toBe(a.openingId);
    expect(await prisma.walletTransaction.count({ where: { userId: user.id, type: "MYSTERY_BOX_PURCHASE" } })).toBe(1);
  });

  it("rejects boxes the user cannot afford", async () => {
    const user = await createUser({ balance: 50 });
    await expect(openBox({ userId: user.id, box: "test-box", idempotencyKey: key() })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await prisma.mysteryBoxOpening.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("leaderboards & privacy", () => {
  it("ranks collection value and anonymises private profiles", async () => {
    const rich = await createUser();
    const shy = await createUser();
    const chase = fx.cards.find((c) => c.rarity === "CHASE")!;
    await giveCard(rich.id, chase.id);
    await giveCard(rich.id, chase.id);
    await giveCard(shy.id, chase.id);
    await updateProfile(shy.id, { profileVisibility: "PRIVATE" });
    const board = await getLeaderboard("collection_value", "all", null);
    expect(board.entries[0].user.username).toBe(rich.username);
    expect(board.entries[1].user).toMatchObject({ username: "Anonymous collector", id: null });
    const own = await getLeaderboard("collection_value", "all", shy.id);
    expect(own.entries.find((e) => e.isViewer)?.user.username).toBe(shy.username);
    const profile = await getProfile(shy.username, null);
    expect(profile.private).toBe(true);
  });

  it("never exposes private usernames in the activity feed", async () => {
    const user = await createUser({ balance: 10_000 });
    await updateProfile(user.id, { profileVisibility: "PRIVATE" });
    await openPacks({ userId: user.id, pack: "premium-pack", quantity: 1, idempotencyKey: key() });
    const feed = await listActivity({ limit: 20 });
    expect(feed.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(feed);
    expect(serialized).not.toContain(user.username);
    expect(feed.every((f) => f.user?.username === "Anonymous collector")).toBe(true);
  });

  it("hides private usernames in marketplace listings and sale history", async () => {
    const { createListing, buyListing, getSaleHistory, searchListings } = await import("@/server/services/marketplace");
    const seller = await createUser();
    const buyer = await createUser({ balance: 1_000 });
    await updateProfile(seller.id, { profileVisibility: "PRIVATE" });
    const copy = await giveCard(seller.id, fx.cards[0].id);
    const second = await giveCard(seller.id, fx.cards[1].id);
    const { listing } = await createListing(seller.id, copy.id, 50);
    await createListing(seller.id, second.id, 60);
    const listings = await searchListings({ sort: "newest", page: 1, limit: 10 });
    expect(JSON.stringify(listings)).not.toContain(seller.username);
    await buyListing(buyer.id, listing.id);
    const history = await getSaleHistory({ viewerId: buyer.id });
    expect(history[0].seller.username).toBe("Anonymous collector");
    expect(history[0].buyer.username).toBe(buyer.username);
    const own = await getSaleHistory({ viewerId: seller.id });
    expect(own[0].seller.username).toBe(seller.username);
  });

  it("filters biggest pulls by period", async () => {
    const user = await createUser({ balance: 10_000 });
    await openPacks({ userId: user.id, pack: "premium-pack", quantity: 1, idempotencyKey: key() });
    await prisma.packOpeningReward.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 10 * 86_400_000) } });
    expect((await getLeaderboard("biggest_pull", "week", null)).entries).toHaveLength(0);
    expect((await getLeaderboard("biggest_pull", "month", null)).entries[0].card).toBeTruthy();
  });
});
