import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { buyListing, cancelListing, createListing, searchListings } from "@/server/services/marketplace";
import { sellCards, sellDuplicates } from "@/server/services/collection";
import { assertLedgerConsistent, balanceOf, createUser, giveCard, seedFixture, type Fixture } from "./fixtures";

let fx: Fixture;
beforeEach(async () => {
  fx = await seedFixture();
  // Isolate the money math from progression rewards.
  await prisma.achievement.deleteMany();
});

const cardOf = (rarity: string) => fx.cards.find((c) => c.rarity === rarity)!;

describe("marketplace", () => {
  it("lists, sells and transfers a card with fee accounting", async () => {
    const seller = await createUser({ balance: 0 });
    const buyer = await createUser({ balance: 5_000 });
    const card = cardOf("ULTRA_RARE");
    const copy = await giveCard(seller.id, card.id, card.value);
    const { listing } = await createListing(seller.id, copy.id, 1_000);
    expect((await prisma.userCard.findUniqueOrThrow({ where: { id: copy.id } })).status).toBe("LISTED");

    const found = await searchListings({ sort: "newest", page: 1, limit: 10 });
    expect(found.items.map((l) => l.id)).toContain(listing.id);

    const sale = await buyListing(buyer.id, listing.id);
    expect(sale.fee).toBe(50); // 5%
    expect(await balanceOf(buyer.id)).toBe(4_000);
    expect(await balanceOf(seller.id)).toBe(950);
    const moved = await prisma.userCard.findUniqueOrThrow({ where: { id: copy.id } });
    expect(moved).toMatchObject({ userId: buyer.id, status: "OWNED", source: "MARKETPLACE", acquiredValue: 1_000 });
    expect(await prisma.marketplaceListing.findUniqueOrThrow({ where: { id: listing.id } })).toMatchObject({ status: "SOLD", buyerId: buyer.id });
    expect(await prisma.marketplaceTransaction.count({ where: { listingId: listing.id } })).toBe(1);
    await assertLedgerConsistent(buyer.id);
    await assertLedgerConsistent(seller.id);
  });

  it("prevents buying your own listing", async () => {
    const seller = await createUser({ balance: 5_000 });
    const copy = await giveCard(seller.id, cardOf("RARE").id);
    const { listing } = await createListing(seller.id, copy.id, 100);
    await expect(buyListing(seller.id, listing.id)).rejects.toThrow(/own listing/);
  });

  it("sells a listing exactly once when buyers race", async () => {
    const seller = await createUser({ balance: 0 });
    const copy = await giveCard(seller.id, cardOf("SECRET_RARE").id);
    const { listing } = await createListing(seller.id, copy.id, 2_000);
    const buyers = await Promise.all(Array.from({ length: 6 }, () => createUser({ balance: 10_000 })));
    const results = await Promise.allSettled(buyers.map((b) => buyListing(b.id, listing.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect(String(r.reason.message)).toMatch(/just sold|no longer|unavailable/i);
    const balances = await Promise.all(buyers.map((b) => balanceOf(b.id)));
    expect(balances.filter((b) => b === 8_000)).toHaveLength(1);
    expect(balances.filter((b) => b === 10_000)).toHaveLength(5);
    expect(await balanceOf(seller.id)).toBe(1_900);
  });

  it("rejects purchases without enough Rip Coins", async () => {
    const seller = await createUser({ balance: 0 });
    const buyer = await createUser({ balance: 99 });
    const copy = await giveCard(seller.id, cardOf("RARE").id);
    const { listing } = await createListing(seller.id, copy.id, 100);
    await expect(buyListing(buyer.id, listing.id)).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await prisma.marketplaceListing.findUniqueOrThrow({ where: { id: listing.id } })).toMatchObject({ status: "ACTIVE" });
    expect((await prisma.userCard.findUniqueOrThrow({ where: { id: copy.id } })).userId).toBe(seller.id);
  });

  it("only lets owners list, and never the same copy twice", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const copy = await giveCard(owner.id, cardOf("RARE").id);
    await expect(createListing(stranger.id, copy.id, 100)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await createListing(owner.id, copy.id, 100);
    await expect(createListing(owner.id, copy.id, 120)).rejects.toThrow(/already listed/);
    const races = await Promise.allSettled([createListing(owner.id, (await giveCard(owner.id, cardOf("RARE").id)).id, 50)]);
    expect(races[0].status).toBe("fulfilled");
  });

  it("cancels listings for the seller only and returns the card", async () => {
    const seller = await createUser();
    const other = await createUser();
    const copy = await giveCard(seller.id, cardOf("RARE").id);
    const { listing } = await createListing(seller.id, copy.id, 100);
    await expect(cancelListing(other.id, listing.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await cancelListing(seller.id, listing.id);
    expect((await prisma.userCard.findUniqueOrThrow({ where: { id: copy.id } })).status).toBe("OWNED");
    await expect(cancelListing(seller.id, listing.id)).rejects.toThrow(/no longer active/);
    await expect(buyListing(other.id, listing.id)).rejects.toThrow(/just sold or cancelled/);
  });
});

describe("instant sell", () => {
  it("pays the configured percentage of virtual value and removes the cards", async () => {
    const user = await createUser({ balance: 0 });
    const card = cardOf("ULTRA_RARE");
    const copies = await Promise.all([giveCard(user.id, card.id), giveCard(user.id, card.id)]);
    const res = await sellCards(user.id, copies.map((c) => c.id));
    expect(res.total).toBe(Math.floor(card.value * 0.7) * 2);
    expect(await balanceOf(user.id)).toBe(res.total);
    expect(await prisma.userCard.count({ where: { userId: user.id } })).toBe(0);
    const tx = await prisma.walletTransaction.findFirstOrThrow({ where: { userId: user.id, type: "CARD_SALE" } });
    expect(tx.amount).toBe(res.total);
    await assertLedgerConsistent(user.id);
  });

  it("refuses to sell cards the user does not own or has listed", async () => {
    const user = await createUser();
    const other = await createUser();
    const theirs = await giveCard(other.id, cardOf("RARE").id);
    await expect(sellCards(user.id, [theirs.id])).rejects.toMatchObject({ code: "NOT_FOUND" });
    const mine = await giveCard(user.id, cardOf("RARE").id);
    await createListing(user.id, mine.id, 500);
    await expect(sellCards(user.id, [mine.id])).rejects.toThrow(/Cancel the marketplace listing/);
    expect(await prisma.userCard.count({ where: { id: theirs.id, userId: other.id } })).toBe(1);
  });

  it("cannot sell the same copy twice under concurrency", async () => {
    const user = await createUser({ balance: 0 });
    const copy = await giveCard(user.id, cardOf("CHASE").id);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => sellCards(user.id, [copy.id])));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await balanceOf(user.id)).toBe(Math.floor(cardOf("CHASE").value * 0.7));
    await assertLedgerConsistent(user.id);
  });

  it("sells only duplicates, keeps listed copies, and tracks the duplicate mission", async () => {
    const user = await createUser({ balance: 0 });
    const common = cardOf("COMMON");
    const rare = cardOf("RARE");
    await Promise.all([giveCard(user.id, common.id), giveCard(user.id, common.id), giveCard(user.id, common.id)]);
    const listed = await giveCard(user.id, rare.id);
    await giveCard(user.id, rare.id);
    await createListing(user.id, listed.id, 999);
    const res = await sellDuplicates(user.id, ["COMMON", "RARE"], 1);
    expect(res.sold).toBe(3); // 2 commons + 1 unlisted rare (the listed copy counts as the kept one)
    expect(await prisma.userCard.count({ where: { userId: user.id, cardId: common.id } })).toBe(1);
    expect(await prisma.userCard.count({ where: { userId: user.id, cardId: rare.id } })).toBe(1);
    expect((await prisma.userCard.findUniqueOrThrow({ where: { id: listed.id } })).status).toBe("LISTED");
    const mission = await prisma.mission.findUniqueOrThrow({ where: { key: "daily-sell-dupe" } });
    expect((await prisma.userMission.findFirstOrThrow({ where: { userId: user.id, missionId: mission.id } })).completedAt).not.toBeNull();
  });
});
