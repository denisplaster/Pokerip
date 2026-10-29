import { utcDateKey } from "@/lib/dates";
import { prisma } from "../db";

/** Everything the header needs: balance, free-pack vouchers and daily-reward status. */
export async function getWalletState(userId: string) {
  const [wallet, vouchers, user] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId }, select: { balance: true } }),
    prisma.packVoucher.groupBy({ by: ["packId"], where: { userId, redeemedAt: null }, _count: true }),
    prisma.user.findUnique({ where: { id: userId }, select: { lastDailyClaimAt: true } }),
  ]);
  return {
    balance: wallet?.balance ?? 0,
    vouchers: Object.fromEntries(vouchers.map((v) => [v.packId, v._count])),
    dailyClaimable: !user?.lastDailyClaimAt || utcDateKey(user.lastDailyClaimAt) !== utcDateKey(),
  };
}
