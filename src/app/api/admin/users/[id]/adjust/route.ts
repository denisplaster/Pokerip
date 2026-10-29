import { adminAdjustBalanceSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { adjustBalance } from "@/server/services/admin";

export const POST = route<{ id: string }>({ auth: "admin", rateLimit: { name: "admin-adjust", limit: 30, windowMs: 60_000 } }, async ({ req, params, user }) => {
  const { amount, reason, idempotencyKey } = await parseJson(req, adminAdjustBalanceSchema);
  return adjustBalance(user.id, params.id, amount, reason, idempotencyKey);
});
