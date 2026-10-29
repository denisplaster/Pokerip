-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "lifetimeEarned" SET DATA TYPE BIGINT,
ALTER COLUMN "lifetimeSpent" SET DATA TYPE BIGINT;

-- Usernames are unique case-insensitively ("Alice" and "alice" cannot coexist).
CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (lower("username"));
