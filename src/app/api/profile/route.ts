import { profileUpdateSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { getAccountSettings, updateProfile } from "@/server/services/profiles";

export const GET = route({ auth: "user" }, async ({ user }) => getAccountSettings(user.id));

export const PATCH = route({ auth: "user", rateLimit: { name: "profile", limit: 20, windowMs: 60_000 } }, async ({ req, user }) => {
  const input = await parseJson(req, profileUpdateSchema);
  return updateProfile(user.id, input);
});
