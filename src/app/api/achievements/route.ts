import { route } from "@/server/api";
import { getAchievements } from "@/server/services/missions";

export const GET = route({ auth: "optional" }, async ({ user }) => ({ achievements: await getAchievements(user?.id ?? null) }));
