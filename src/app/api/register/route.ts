import { registerSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { registerUser } from "@/server/services/users";

export const POST = route({ auth: "none", rateLimit: { name: "register", limit: 5, windowMs: 60 * 60_000 } }, async ({ req }) => {
  const input = await parseJson(req, registerSchema);
  const user = await registerUser({ username: input.username, email: input.email, password: input.password });
  return { id: user.id, username: user.username };
});
