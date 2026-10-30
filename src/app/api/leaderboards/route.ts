import { leaderboardQuerySchema } from "@/lib/validators";
import { parseSearch, route } from "@/server/api";
import { getLeaderboard } from "@/server/services/leaderboards";

export const GET = route({ auth: "optional", rateLimit: { name: "leaderboards", limit: 120, windowMs: 60_000 } }, async ({ req, user }) => {
  const { category, period } = parseSearch(req, leaderboardQuerySchema);
  return getLeaderboard(category, period, user?.id);
});
