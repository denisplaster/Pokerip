/**
 * Seeds a fully playable RipVault: card catalog with 90 days of reproducible
 * price history, packs & odds, mystery boxes, missions, achievements, an admin
 * account (credentials from env) and demo collectors with simulated history.
 *
 *   npm run db:seed            # wipes and re-seeds the database in DATABASE_URL
 *
 * Refuses to run against a production database unless SEED_FORCE=1.
 */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { buildCatalog, SETS, type CardSeed } from "./data/catalog";
import { ACHIEVEMENTS, COLLECTIBLES, DAILY_REWARDS, MISSIONS, MYSTERY_BOXES, PACKS, poolWeight } from "./data/game";
import { DEFAULT_ACTIVITY, DEFAULT_ECONOMY, DEFAULT_MARKET, SIGNUP_BONUS, AVATARS } from "../src/lib/constants";
import { addUtcDays, startOfUtcDay, utcDateKey } from "../src/lib/dates";
import { levelForXp, xpForPack } from "../src/lib/levels";
import { generateHistory } from "../src/lib/market-sim";
import { compilePackOdds, drawPack, type PackOddsSnapshot } from "../src/lib/probability";
import { RARITIES, rarityRank, type RarityKey } from "../src/lib/rarity";
import { createSeededRng } from "../src/lib/rng";
import { prisma, withTransaction } from "../src/server/db";
import { publishBoxOdds, publishPackOdds } from "../src/server/services/odds";
import { checkAchievements, completedSetIds } from "../src/server/services/progression";
import { createUserWithWallet, hashPassword } from "../src/server/services/users";

const rng = createSeededRng("ripvault-demo-seed");
const rand = () => rng.float();
const pick = <T,>(items: readonly T[]) => items[rng.int(items.length)];

async function wipe() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
}

async function seedCatalog() {
  const setIds = new Map<string, string>();
  for (const s of SETS) {
    const set = await prisma.cardSet.create({
      data: { code: s.code, name: s.name, series: s.series, releaseYear: s.releaseYear, printedTotal: s.printedTotal, description: s.description },
    });
    setIds.set(s.code, set.id);
  }
  const catalog = buildCatalog();
  const today = startOfUtcDay();
  const cardIdBySlug = new Map<string, string>();
  const historyRows: { cardId: string; price: number; volume: number; recordedAt: Date }[] = [];
  const cards = catalog.map((c) => {
    const id = randomUUID();
    cardIdBySlug.set(c.slug, id);
    const history = generateHistory(c.slug, c.value, c.rarity, DEFAULT_MARKET, 90);
    for (const h of history) historyRows.push({ cardId: id, price: h.price, volume: h.volume, recordedAt: addUtcDays(today, -h.daysAgo) });
    return {
      id,
      slug: c.slug,
      setId: setIds.get(c.set)!,
      name: c.name,
      pokemon: c.pokemon,
      number: c.number,
      variant: c.variant,
      rarity: c.rarity,
      energyType: c.energyType,
      dexNumber: c.dexNumber,
      grade: c.grade,
      releaseYear: c.releaseYear,
      category: c.category,
      baseValue: c.value,
      currentValue: history[history.length - 1].price,
      externalId: c.externalId,
    };
  });
  await prisma.card.createMany({ data: cards });
  for (let i = 0; i < historyRows.length; i += 5000) {
    await prisma.cardPriceHistory.createMany({ data: historyRows.slice(i, i + 5000) });
  }
  await prisma.systemSetting.create({ data: { key: "market.lastTick", value: { at: today.toISOString() } } });
  console.log(`  ✓ ${SETS.length} sets, ${cards.length} cards, ${historyRows.length} price points`);
  return { catalog, cardIdBySlug };
}

async function seedPacks(catalog: CardSeed[], cardIdBySlug: Map<string, string>) {
  const packIds = new Map<string, string>();
  for (const [i, p] of PACKS.entries()) {
    const pool = catalog.filter(p.pool);
    const pack = await prisma.pack.create({
      data: {
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        price: p.price,
        cardsPerPack: p.cardsPerPack,
        theme: p.theme,
        featured: p.featured,
        sortOrder: i,
        odds: { create: RARITIES.map((r) => ({ rarity: r, weightPpm: Math.round((p.odds[r] ?? 0) * 10_000) })) },
        pool: { create: pool.map((c) => ({ cardId: cardIdBySlug.get(c.slug)!, weight: poolWeight(c.value) })) },
      },
    });
    await withTransaction((tx) => publishPackOdds(tx, pack.id, "seed"));
    packIds.set(p.slug, pack.id);
  }
  console.log(`  ✓ ${PACKS.length} packs with published odds`);
  return packIds;
}

async function seedBoxes(cardIdBySlug: Map<string, string>, packIds: Map<string, string>) {
  const collectibleIds = new Map<string, string>();
  for (const c of COLLECTIBLES) {
    const row = await prisma.collectible.create({ data: c });
    collectibleIds.set(c.slug, row.id);
  }
  for (const [i, b] of MYSTERY_BOXES.entries()) {
    const box = await prisma.mysteryBox.create({
      data: { slug: b.slug, name: b.name, tagline: b.tagline, description: b.description, price: b.price, theme: b.theme, featured: b.featured, sortOrder: i },
    });
    for (const [j, r] of b.rewards.entries()) {
      await prisma.mysteryBoxReward.create({
        data: {
          boxId: box.id,
          type: r.type,
          label: r.label,
          weightPpm: Math.round(r.percent * 10_000),
          sortOrder: j,
          coins: r.type === "COINS" ? r.coins : null,
          packId: r.type === "PACK_VOUCHER" ? packIds.get(r.pack)! : null,
          collectibleId: r.type === "COLLECTIBLE" ? collectibleIds.get(r.collectible)! : null,
          fallbackCoins: r.type === "COLLECTIBLE" ? r.fallbackCoins : null,
          cards:
            r.type === "CARD"
              ? { create: [{ cardId: cardIdBySlug.get(r.card)!, quantity: 1 }] }
              : r.type === "CARD_BUNDLE"
                ? { create: r.cards.map((slug) => ({ cardId: cardIdBySlug.get(slug)!, quantity: 1 })) }
                : undefined,
        },
      });
    }
    await withTransaction((tx) => publishBoxOdds(tx, box.id, "seed"));
  }
  console.log(`  ✓ ${COLLECTIBLES.length} collectibles, ${MYSTERY_BOXES.length} mystery boxes`);
}

async function seedProgression(packIds: Map<string, string>) {
  await prisma.dailyReward.createMany({
    data: DAILY_REWARDS.map((d) => ({ day: d.day, coins: d.coins, xp: d.xp, label: d.label, packId: d.pack ? packIds.get(d.pack)! : null })),
  });
  await prisma.mission.createMany({ data: MISSIONS.map((m, i) => ({ ...m, sortOrder: i })) });
  await prisma.achievement.createMany({ data: ACHIEVEMENTS.map((a, i) => ({ ...a, sortOrder: i })) });
  await prisma.systemSetting.createMany({
    data: [
      { key: "economy", value: DEFAULT_ECONOMY as object },
      { key: "market", value: DEFAULT_MARKET as object },
      { key: "activity", value: DEFAULT_ACTIVITY as object },
    ],
  });
  console.log(`  ✓ daily rewards, ${MISSIONS.length} missions, ${ACHIEVEMENTS.length} achievements, settings`);
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@ripvault.local").toLowerCase();
  const username = process.env.SEED_ADMIN_USERNAME || "vaultkeeper";
  let password = process.env.SEED_ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = randomBytes(12).toString("base64url");
    generated = true;
  }
  const passwordHash = await hashPassword(password);
  const admin = await withTransaction((tx) => createUserWithWallet(tx, { username, email, passwordHash, avatar: "mewtwo" }));
  await prisma.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
  console.log(`  ✓ admin account: ${email} (username "${username}")`);
  if (generated) console.log(`    generated admin password (shown once): ${password}`);
  return admin;
}

const BOT_NAMES = [
  "HoloHunter", "VintageVic", "MoonbreonMaxi", "RipRoyale", "PikaPulls", "GoldStarGreg", "ShadowlessSam", "AltArtAva",
  "GengarGhost", "SlabSensei", "TeamRocketRio", "MintConditionMo", "BinderBella", "LugiaLane", "ChaseChaser", "FoilFinn",
  "PSA10Priya", "BoosterBox_Ben", "RainbowRareRae", "DragonDeckDax", "EeveeEnthusiast", "WOTC_Walt", "CrystalCat", "SecretSkye",
];

interface BotPlan {
  name: string;
  joinedDaysAgo: number;
  rips: number;
  packWeights: Record<string, number>;
  isPrivate: boolean;
}

function planBots(): BotPlan[] {
  return BOT_NAMES.map((name, i) => {
    const whale = i % 6 === 0;
    const casual = i % 3 === 2;
    return {
      name,
      joinedDaysAgo: 8 + rng.int(52),
      rips: whale ? 70 + rng.int(40) : casual ? 12 + rng.int(14) : 30 + rng.int(30),
      packWeights: (whale
        ? { starter: 1, trainer: 4, eeveelution: 2, ultra: 4, inferno: 2, legendary: 3, master: 2 }
        : casual
          ? { starter: 6, trainer: 4, eeveelution: 1, ultra: 1 }
          : { starter: 3, trainer: 6, eeveelution: 2, ultra: 3, inferno: 1, legendary: 1 }) as Record<string, number>,
      isPrivate: i === 7 || i === 19,
    };
  });
}

function weightedPick(weights: Record<string, number>) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r < 0) return k;
  }
  return entries[0][0];
}

async function seedBots(packIds: Map<string, string>) {
  const packs = await prisma.pack.findMany({ include: { oddsVersions: { orderBy: { version: "desc" }, take: 1 } } });
  const packBySlug = new Map(packs.map((p) => [p.slug, p]));
  const compiled = new Map(packs.map((p) => [p.slug, compilePackOdds(p.oddsVersions[0].data as unknown as PackOddsSnapshot)]));
  const cards = await prisma.card.findMany({ select: { id: true, name: true, variant: true, rarity: true, currentValue: true } });
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const now = Date.now();
  const bots: { id: string; username: string }[] = [];
  const activity: { type: "BIG_PULL"; userId: string; cardId: string; rarity: RarityKey; value: number; message: string; createdAt: Date; metadata: object }[] = [];

  for (const plan of planBots()) {
    const joinedAt = new Date(now - plan.joinedDaysAgo * 86_400_000);
    const user = await withTransaction((tx) =>
      createUserWithWallet(tx, { username: plan.name, avatar: pick(AVATARS).key, isBot: true, createdAt: joinedAt }),
    );
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    bots.push({ id: user.id, username: user.username });

    // Build the bot's rip history in chronological order.
    const times = Array.from({ length: plan.rips }, () => joinedAt.getTime() + rand() * (now - joinedAt.getTime() - 60_000)).sort((a, b) => a - b);
    let balance = SIGNUP_BONUS;
    let earned = SIGNUP_BONUS;
    let spent = 0;
    let xp = 0;
    const ledger: object[] = [];
    const openings: object[] = [];
    const rewards: object[] = [];
    const userCards: object[] = [];

    for (const t of times) {
      const slug = weightedPick(plan.packWeights);
      const pack = packBySlug.get(slug)!;
      const at = new Date(t);
      if (balance < pack.price) {
        // Demo collectors receive clearly labelled grants so their ledger stays consistent.
        const grant = Math.max(pack.price * 3, 5_000);
        ledger.push({ walletId: wallet.id, userId: user.id, type: "ADMIN_ADJUSTMENT", amount: grant, balanceBefore: balance, balanceAfter: balance + grant, description: "Demo collector funding (seed data)", createdAt: new Date(t - 1000) });
        balance += grant;
        earned += grant;
      }
      const batchId = `${user.id}:seed-${openings.length}`;
      ledger.push({ walletId: wallet.id, userId: user.id, type: "PACK_PURCHASE", amount: -pack.price, balanceBefore: balance, balanceAfter: balance - pack.price, description: pack.name, packId: pack.id, packOpeningBatchId: batchId, createdAt: at });
      balance -= pack.price;
      spent += pack.price;
      xp += xpForPack(pack.price);

      const draws = drawPack(compiled.get(slug)!, rng);
      const openingId = randomUUID();
      let total = 0;
      draws.forEach((d, slot) => {
        const card = cardById.get(d.cardId)!;
        const userCardId = randomUUID();
        total += card.currentValue;
        userCards.push({ id: userCardId, userId: user.id, cardId: card.id, source: "PACK", acquiredValue: card.currentValue, acquiredAt: at });
        rewards.push({ id: randomUUID(), openingId, userId: user.id, cardId: card.id, userCardId, slot, rarity: d.rarity, value: card.currentValue, rarityRoll: d.rarityRoll, cardRoll: d.cardRoll, createdAt: at });
        if (rarityRank(d.rarity) >= rarityRank("ULTRA_RARE") && (card.currentValue >= DEFAULT_ACTIVITY.bigPullMinValue || d.rarity === "CHASE")) {
          activity.push({
            type: "BIG_PULL",
            userId: user.id,
            cardId: card.id,
            rarity: d.rarity,
            value: card.currentValue,
            message: `pulled ${card.name}${card.variant ? ` (${card.variant})` : ""} from a ${pack.name}`,
            createdAt: at,
            metadata: { packSlug: pack.slug, packName: pack.name },
          });
        }
      });
      openings.push({ id: openingId, userId: user.id, packId: pack.id, oddsVersionId: pack.oddsVersions[0].id, batchId, idempotencyKey: `seed-${openings.length}:00`, pricePaid: pack.price, totalValue: total, createdAt: at });
    }

    await prisma.walletTransaction.createMany({ data: ledger as never });
    await prisma.packOpening.createMany({ data: openings as never });
    await prisma.userCard.createMany({ data: userCards as never });
    await prisma.packOpeningReward.createMany({ data: rewards as never });
    const streak = rng.int(12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        packsOpened: plan.rips,
        xp,
        level: levelForXp(xp),
        loginStreak: streak,
        lastDailyClaimAt: streak ? addUtcDays(new Date(), -1) : null,
        profileVisibility: plan.isPrivate ? "PRIVATE" : "PUBLIC",
        bio: plan.isPrivate ? null : pick(["Chasing alt arts one rip at a time.", "Vintage only. Mostly.", "Moonbreon or bust.", "Slabs, stars and shiny things.", "Here for the commons, honestly.", "Completing every set in the vault."]),
      },
    });
    await prisma.wallet.update({ where: { id: wallet.id }, data: { balance, lifetimeEarned: earned, lifetimeSpent: spent } });
  }
  await prisma.activityEvent.createMany({ data: activity });

  // Achievements (and their rewards) for each bot, through the real service.
  for (const bot of bots) {
    await withTransaction(async (tx) => {
      await checkAchievements(tx, bot.id, ["PACKS_OPENED", "UNIQUE_CARDS", "TOTAL_CARDS", "COLLECTION_VALUE", "SETS_COMPLETED", "CHASE_PULLS", "SECRET_PULLS", "BIGGEST_PULL", "LEVEL", "LOGIN_STREAK"], []);
      await completedSetIds(tx, bot.id);
    });
  }
  console.log(`  ✓ ${bots.length} demo collectors with ${activity.length} notable pulls`);
  void packIds;
  return bots;
}

async function seedMarketplace(bots: { id: string; username: string }[]) {
  const listingsData: object[] = [];
  let sales = 0;
  for (const bot of bots) {
    // List a handful of duplicates and mid-value cards.
    const copies = await prisma.userCard.findMany({
      where: { userId: bot.id, status: "OWNED" },
      orderBy: { acquiredAt: "desc" },
      select: { id: true, cardId: true, card: { select: { currentValue: true, rarity: true } } },
    });
    const candidates = copies.filter((c) => c.card.currentValue >= 40).slice(0, 40);
    const count = Math.min(candidates.length, 3 + rng.int(6));
    for (let i = 0; i < count; i++) {
      const copy = candidates.splice(rng.int(candidates.length), 1)[0];
      const markup = 0.85 + rand() * 0.5;
      const price = Math.max(1, Math.round(copy.card.currentValue * markup));
      await prisma.userCard.update({ where: { id: copy.id }, data: { status: "LISTED" } });
      listingsData.push({ sellerId: bot.id, userCardId: copy.id, cardId: copy.cardId, price, createdAt: new Date(Date.now() - rng.int(6 * 86_400_000)) });
    }
  }
  await prisma.marketplaceListing.createMany({ data: listingsData as never });

  // A few historical bot-to-bot sales, executed through the real marketplace flow.
  const { buyListing } = await import("../src/server/services/marketplace");
  const listings = await prisma.marketplaceListing.findMany({ where: { status: "ACTIVE" }, select: { id: true, sellerId: true, price: true } });
  for (const listing of listings) {
    if (rand() > 0.18) continue;
    const buyer = pick(bots.filter((b) => b.id !== listing.sellerId));
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: buyer.id } });
    if (wallet.balance < listing.price) continue;
    await buyListing(buyer.id, listing.id);
    sales++;
  }
  // Spread sale timestamps over the past week so history charts look natural.
  const recent = await prisma.marketplaceTransaction.findMany({ select: { id: true, listingId: true } });
  for (const sale of recent) {
    const at = new Date(Date.now() - rng.int(7 * 86_400_000));
    await prisma.marketplaceTransaction.update({ where: { id: sale.id }, data: { createdAt: at } });
    await prisma.marketplaceListing.update({ where: { id: sale.listingId }, data: { soldAt: at } });
  }
  console.log(`  ✓ ${listingsData.length} marketplace listings, ${sales} historical sales`);
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
    throw new Error("Refusing to wipe and seed a production database. Set SEED_FORCE=1 to override.");
  }
  console.log(`Seeding ${url.replace(/\/\/[^@]*@/, "//***@")}`);
  await wipe();
  const { catalog, cardIdBySlug } = await seedCatalog();
  const packIds = await seedPacks(catalog, cardIdBySlug);
  await seedBoxes(cardIdBySlug, packIds);
  await seedProgression(packIds);
  await seedAdmin();
  const bots = await seedBots(packIds);
  await seedMarketplace(bots);
  console.log(`Done. (${utcDateKey()})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
