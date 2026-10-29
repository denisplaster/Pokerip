import { route } from "@/server/api";
import { getMissions } from "@/server/services/missions";

export const GET = route({ auth: "user" }, async ({ user }) => ({ missions: await getMissions(user.id) }));
