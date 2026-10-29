import { route } from "@/server/api";
import { claimDailyReward, getDailyStatus } from "@/server/services/daily";

export const GET = route({ auth: "user" }, async ({ user }) => getDailyStatus(user.id));

export const POST = route({ auth: "user", rateLimit: { name: "daily", limit: 10, windowMs: 60_000 } }, async ({ user }) => claimDailyReward(user.id));
