import { route } from "@/server/api";
import { claimMission } from "@/server/services/missions";

export const POST = route<{ id: string }>({ auth: "user", rateLimit: { name: "mission-claim", limit: 30, windowMs: 60_000 } }, async ({ params, user }) =>
  claimMission(user.id, params.id),
);
