import { passwordChangeSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { changePassword } from "@/server/services/profiles";

export const POST = route({ auth: "user", rateLimit: { name: "password", limit: 5, windowMs: 15 * 60_000 } }, async ({ req, user }) => {
  const { currentPassword, newPassword } = await parseJson(req, passwordChangeSchema);
  return changePassword(user.id, currentPassword, newPassword);
});
