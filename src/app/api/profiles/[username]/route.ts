import { route } from "@/server/api";
import { getProfile } from "@/server/services/profiles";

export const GET = route<{ username: string }>({ auth: "optional" }, async ({ params, user }) => getProfile(params.username, user?.id ?? null));
