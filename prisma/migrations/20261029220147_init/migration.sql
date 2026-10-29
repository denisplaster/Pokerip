-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'ULTRA_RARE', 'SECRET_RARE', 'CHASE');

-- CreateEnum
CREATE TYPE "CardCategory" AS ENUM ('VINTAGE', 'MODERN', 'ILLUSTRATION', 'GRADED', 'PROMO');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SIGNUP_BONUS', 'PACK_PURCHASE', 'MYSTERY_BOX_PURCHASE', 'MYSTERY_BOX_REWARD', 'CARD_SALE', 'MARKETPLACE_PURCHASE', 'MARKETPLACE_SALE', 'DAILY_REWARD', 'MISSION_REWARD', 'ACHIEVEMENT_REWARD', 'LEVEL_UP_REWARD', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CardSource" AS ENUM ('PACK', 'MYSTERY_BOX', 'MARKETPLACE', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserCardStatus" AS ENUM ('OWNED', 'LISTED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MysteryBoxRewardType" AS ENUM ('CARD', 'CARD_BUNDLE', 'COINS', 'PACK_VOUCHER', 'COLLECTIBLE');

-- CreateEnum
CREATE TYPE "VoucherSource" AS ENUM ('DAILY_REWARD', 'MYSTERY_BOX', 'ADMIN');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('OPEN_PACKS', 'COLLECT_UNIQUE', 'COMPLETE_SET', 'SELL_DUPLICATE', 'EARN_COINS', 'OPEN_MYSTERY_BOX', 'LIST_ON_MARKETPLACE');

-- CreateEnum
CREATE TYPE "MissionPeriod" AS ENUM ('DAILY', 'WEEKLY', 'ONCE');

-- CreateEnum
CREATE TYPE "AchievementTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "AchievementMetric" AS ENUM ('PACKS_OPENED', 'UNIQUE_CARDS', 'TOTAL_CARDS', 'COLLECTION_VALUE', 'SETS_COMPLETED', 'CHASE_PULLS', 'SECRET_PULLS', 'MARKET_SALES', 'LEVEL', 'LOGIN_STREAK', 'BIGGEST_PULL');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('BIG_PULL', 'MYSTERY_BOX_WIN', 'ACHIEVEMENT_UNLOCKED', 'LEVEL_UP', 'MARKETPLACE_SALE', 'SET_COMPLETED');

-- CreateEnum
CREATE TYPE "OddsKind" AS ENUM ('PACK', 'MYSTERY_BOX');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "avatar" TEXT NOT NULL DEFAULT 'pikachu',
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "bio" TEXT,
    "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "loginStreak" INTEGER NOT NULL DEFAULT 0,
    "lastDailyClaimAt" TIMESTAMP(3),
    "packsOpened" INTEGER NOT NULL DEFAULT 0,
    "boxesOpened" INTEGER NOT NULL DEFAULT 0,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "packId" TEXT,
    "cardId" TEXT,
    "packOpeningBatchId" TEXT,
    "mysteryBoxId" TEXT,
    "mysteryBoxOpeningId" TEXT,
    "listingId" TEXT,
    "adminId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "releaseYear" INTEGER NOT NULL,
    "printedTotal" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pokemon" TEXT,
    "number" TEXT NOT NULL,
    "variant" TEXT,
    "rarity" "Rarity" NOT NULL,
    "energyType" TEXT NOT NULL DEFAULT 'colorless',
    "dexNumber" INTEGER,
    "imageUrl" TEXT,
    "grade" TEXT,
    "releaseYear" INTEGER NOT NULL,
    "category" "CardCategory" NOT NULL,
    "baseValue" INTEGER NOT NULL,
    "currentValue" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPriceHistory" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "volume" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "status" "UserCardStatus" NOT NULL DEFAULT 'OWNED',
    "source" "CardSource" NOT NULL,
    "acquiredValue" INTEGER NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteCard" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteCard_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateTable
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "cardsPerPack" INTEGER NOT NULL,
    "theme" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackRarityOdds" (
    "packId" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "weightPpm" INTEGER NOT NULL,

    CONSTRAINT "PackRarityOdds_pkey" PRIMARY KEY ("packId","rarity")
);

-- CreateTable
CREATE TABLE "PackDropPool" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "PackDropPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsVersion" (
    "id" TEXT NOT NULL,
    "kind" "OddsKind" NOT NULL,
    "packId" TEXT,
    "boxId" TEXT,
    "version" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "OddsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackOpening" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "oddsVersionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "totalValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackOpeningReward" (
    "id" TEXT NOT NULL,
    "openingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userCardId" TEXT,
    "slot" INTEGER NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "value" INTEGER NOT NULL,
    "rarityRoll" INTEGER NOT NULL,
    "cardRoll" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackOpeningReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackVoucher" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "source" "VoucherSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),
    "openingId" TEXT,

    CONSTRAINT "PackVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "userCardId" TEXT,
    "cardId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "soldAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceTransaction" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "sellerProceeds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MysteryBox" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "theme" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MysteryBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MysteryBoxReward" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "type" "MysteryBoxRewardType" NOT NULL,
    "label" TEXT NOT NULL,
    "weightPpm" INTEGER NOT NULL,
    "coins" INTEGER,
    "packId" TEXT,
    "collectibleId" TEXT,
    "fallbackCoins" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MysteryBoxReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MysteryBoxRewardCard" (
    "rewardId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MysteryBoxRewardCard_pkey" PRIMARY KEY ("rewardId","cardId")
);

-- CreateTable
CREATE TABLE "MysteryBoxOpening" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "oddsVersionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "roll" INTEGER NOT NULL,
    "valueAwarded" INTEGER NOT NULL,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MysteryBoxOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collectible" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "icon" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "maxSupply" INTEGER,
    "mintedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collectible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCollectible" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collectibleId" TEXT NOT NULL,
    "serialNumber" INTEGER NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCollectible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReward" (
    "day" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "packId" TEXT,
    "label" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReward_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "DailyRewardClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "streak" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "voucherId" TEXT,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyRewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "MissionType" NOT NULL,
    "period" "MissionPeriod" NOT NULL,
    "target" INTEGER NOT NULL,
    "rewardCoins" INTEGER NOT NULL,
    "rewardXp" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "tier" "AchievementTier" NOT NULL,
    "metric" "AchievementMetric" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "rewardCoins" INTEGER NOT NULL DEFAULT 0,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId","achievementId")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "userId" TEXT,
    "cardId" TEXT,
    "rarity" "Rarity",
    "value" INTEGER,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_level_xp_idx" ON "User"("level", "xp");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_balance_idx" ON "Wallet"("balance");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key" ON "WalletTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_createdAt_idx" ON "WalletTransaction"("type", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CardSet_code_key" ON "CardSet"("code");

-- CreateIndex
CREATE INDEX "CardSet_releaseYear_idx" ON "CardSet"("releaseYear");

-- CreateIndex
CREATE UNIQUE INDEX "Card_slug_key" ON "Card"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Card_externalId_key" ON "Card"("externalId");

-- CreateIndex
CREATE INDEX "Card_setId_idx" ON "Card"("setId");

-- CreateIndex
CREATE INDEX "Card_rarity_idx" ON "Card"("rarity");

-- CreateIndex
CREATE INDEX "Card_currentValue_idx" ON "Card"("currentValue");

-- CreateIndex
CREATE INDEX "Card_pokemon_idx" ON "Card"("pokemon");

-- CreateIndex
CREATE INDEX "CardPriceHistory_cardId_recordedAt_idx" ON "CardPriceHistory"("cardId", "recordedAt");

-- CreateIndex
CREATE INDEX "CardPriceHistory_recordedAt_idx" ON "CardPriceHistory"("recordedAt");

-- CreateIndex
CREATE INDEX "UserCard_userId_cardId_idx" ON "UserCard"("userId", "cardId");

-- CreateIndex
CREATE INDEX "UserCard_userId_acquiredAt_idx" ON "UserCard"("userId", "acquiredAt");

-- CreateIndex
CREATE INDEX "UserCard_cardId_idx" ON "UserCard"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "Pack_slug_key" ON "Pack"("slug");

-- CreateIndex
CREATE INDEX "Pack_isActive_sortOrder_idx" ON "Pack"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PackDropPool_cardId_idx" ON "PackDropPool"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "PackDropPool_packId_cardId_key" ON "PackDropPool"("packId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "OddsVersion_packId_version_key" ON "OddsVersion"("packId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "OddsVersion_boxId_version_key" ON "OddsVersion"("boxId", "version");

-- CreateIndex
CREATE INDEX "PackOpening_userId_createdAt_idx" ON "PackOpening"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PackOpening_batchId_idx" ON "PackOpening"("batchId");

-- CreateIndex
CREATE INDEX "PackOpening_packId_createdAt_idx" ON "PackOpening"("packId", "createdAt");

-- CreateIndex
CREATE INDEX "PackOpening_createdAt_idx" ON "PackOpening"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PackOpening_userId_idempotencyKey_key" ON "PackOpening"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PackOpeningReward_userCardId_key" ON "PackOpeningReward"("userCardId");

-- CreateIndex
CREATE INDEX "PackOpeningReward_openingId_idx" ON "PackOpeningReward"("openingId");

-- CreateIndex
CREATE INDEX "PackOpeningReward_userId_value_idx" ON "PackOpeningReward"("userId", "value");

-- CreateIndex
CREATE INDEX "PackOpeningReward_createdAt_value_idx" ON "PackOpeningReward"("createdAt", "value");

-- CreateIndex
CREATE INDEX "PackOpeningReward_rarity_createdAt_idx" ON "PackOpeningReward"("rarity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PackVoucher_openingId_key" ON "PackVoucher"("openingId");

-- CreateIndex
CREATE INDEX "PackVoucher_userId_redeemedAt_idx" ON "PackVoucher"("userId", "redeemedAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_createdAt_idx" ON "MarketplaceListing"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_price_idx" ON "MarketplaceListing"("status", "price");

-- CreateIndex
CREATE INDEX "MarketplaceListing_cardId_status_idx" ON "MarketplaceListing"("cardId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceListing_sellerId_status_idx" ON "MarketplaceListing"("sellerId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceListing_userCardId_idx" ON "MarketplaceListing"("userCardId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceTransaction_listingId_key" ON "MarketplaceTransaction"("listingId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_createdAt_idx" ON "MarketplaceTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_cardId_createdAt_idx" ON "MarketplaceTransaction"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_buyerId_createdAt_idx" ON "MarketplaceTransaction"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_sellerId_createdAt_idx" ON "MarketplaceTransaction"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MysteryBox_slug_key" ON "MysteryBox"("slug");

-- CreateIndex
CREATE INDEX "MysteryBoxReward_boxId_idx" ON "MysteryBoxReward"("boxId");

-- CreateIndex
CREATE INDEX "MysteryBoxOpening_userId_createdAt_idx" ON "MysteryBoxOpening"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MysteryBoxOpening_boxId_createdAt_idx" ON "MysteryBoxOpening"("boxId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MysteryBoxOpening_userId_idempotencyKey_key" ON "MysteryBoxOpening"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Collectible_slug_key" ON "Collectible"("slug");

-- CreateIndex
CREATE INDEX "UserCollectible_userId_idx" ON "UserCollectible"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCollectible_collectibleId_serialNumber_key" ON "UserCollectible"("collectibleId", "serialNumber");

-- CreateIndex
CREATE INDEX "DailyRewardClaim_claimedAt_idx" ON "DailyRewardClaim"("claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRewardClaim_userId_dateKey_key" ON "DailyRewardClaim"("userId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_key_key" ON "Mission"("key");

-- CreateIndex
CREATE INDEX "UserMission_userId_periodKey_idx" ON "UserMission"("userId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserMission_userId_missionId_periodKey_key" ON "UserMission"("userId", "missionId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- CreateIndex
CREATE INDEX "UserAchievement_unlockedAt_idx" ON "UserAchievement"("unlockedAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_type_createdAt_idx" ON "ActivityEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_mysteryBoxId_fkey" FOREIGN KEY ("mysteryBoxId") REFERENCES "MysteryBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPriceHistory" ADD CONSTRAINT "CardPriceHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteCard" ADD CONSTRAINT "FavoriteCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteCard" ADD CONSTRAINT "FavoriteCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackRarityOdds" ADD CONSTRAINT "PackRarityOdds_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackDropPool" ADD CONSTRAINT "PackDropPool_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackDropPool" ADD CONSTRAINT "PackDropPool_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OddsVersion" ADD CONSTRAINT "OddsVersion_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OddsVersion" ADD CONSTRAINT "OddsVersion_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "MysteryBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpening" ADD CONSTRAINT "PackOpening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpening" ADD CONSTRAINT "PackOpening_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpening" ADD CONSTRAINT "PackOpening_oddsVersionId_fkey" FOREIGN KEY ("oddsVersionId") REFERENCES "OddsVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpeningReward" ADD CONSTRAINT "PackOpeningReward_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "PackOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpeningReward" ADD CONSTRAINT "PackOpeningReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpeningReward" ADD CONSTRAINT "PackOpeningReward_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpeningReward" ADD CONSTRAINT "PackOpeningReward_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackVoucher" ADD CONSTRAINT "PackVoucher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackVoucher" ADD CONSTRAINT "PackVoucher_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackVoucher" ADD CONSTRAINT "PackVoucher_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "PackOpening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MysteryBoxReward" ADD CONSTRAINT "MysteryBoxReward_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "MysteryBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MysteryBoxReward" ADD CONSTRAINT "MysteryBoxReward_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MysteryBoxReward" ADD CONSTRAINT "MysteryBoxReward_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MysteryBoxRewardCard" ADD CONSTRAINT "MysteryBoxRewardCard_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "MysteryBoxReward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MysteryBoxRewardCard" ADD CONSTRAINT "MysteryBoxRewardCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MysteryBoxOpening" ADD CONSTRAINT "MysteryBoxOpening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MysteryBoxOpening" ADD CONSTRAINT "MysteryBoxOpening_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "MysteryBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MysteryBoxOpening" ADD CONSTRAINT "MysteryBoxOpening_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "MysteryBoxReward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MysteryBoxOpening" ADD CONSTRAINT "MysteryBoxOpening_oddsVersionId_fkey" FOREIGN KEY ("oddsVersionId") REFERENCES "OddsVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollectible" ADD CONSTRAINT "UserCollectible_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollectible" ADD CONSTRAINT "UserCollectible_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReward" ADD CONSTRAINT "DailyReward_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRewardClaim" ADD CONSTRAINT "DailyRewardClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMission" ADD CONSTRAINT "UserMission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMission" ADD CONSTRAINT "UserMission_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Integrity constraints that Prisma's schema language cannot express.
-- ─────────────────────────────────────────────────────────────────────────────

-- Balances can never go negative, even if application code has a bug.
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_balance_non_negative" CHECK ("balance" >= 0);

-- Every ledger row must be internally consistent.
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_balance_math"
  CHECK ("balanceAfter" = "balanceBefore" + "amount" AND "balanceAfter" >= 0);

-- A given copy of a card can only have one active listing at a time.
CREATE UNIQUE INDEX "MarketplaceListing_one_active_per_card"
  ON "MarketplaceListing" ("userCardId") WHERE "status" = 'ACTIVE';

ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_price_positive" CHECK ("price" > 0);
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_price_non_negative" CHECK ("price" >= 0);
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_cards_positive" CHECK ("cardsPerPack" > 0);
ALTER TABLE "MysteryBox" ADD CONSTRAINT "MysteryBox_price_non_negative" CHECK ("price" >= 0);
ALTER TABLE "PackRarityOdds" ADD CONSTRAINT "PackRarityOdds_weight_range" CHECK ("weightPpm" >= 0 AND "weightPpm" <= 1000000);
ALTER TABLE "PackDropPool" ADD CONSTRAINT "PackDropPool_weight_positive" CHECK ("weight" > 0);
ALTER TABLE "MysteryBoxReward" ADD CONSTRAINT "MysteryBoxReward_weight_range" CHECK ("weightPpm" >= 0 AND "weightPpm" <= 1000000);
ALTER TABLE "Card" ADD CONSTRAINT "Card_values_positive" CHECK ("baseValue" > 0 AND "currentValue" > 0);
ALTER TABLE "Collectible" ADD CONSTRAINT "Collectible_supply" CHECK ("maxSupply" IS NULL OR "mintedCount" <= "maxSupply");
