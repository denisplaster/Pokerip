import { openBoxSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { openBox } from "@/server/services/mystery-boxes";

export const POST = route<{ id: string }>({ auth: "user", rateLimit: { name: "open-box", limit: 40, windowMs: 60_000 } }, async ({ req, params, user }) => {
  const { idempotencyKey } = await parseJson(req, openBoxSchema);
  return openBox({ userId: user.id, box: params.id, idempotencyKey });
});
