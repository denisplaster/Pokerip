import { adminDailyRewardsSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { saveDailyRewards } from "@/server/services/admin";

export const PUT = route({ auth: "admin" }, async ({ req, user }) => saveDailyRewards(user.id, (await parseJson(req, adminDailyRewardsSchema)).days));
