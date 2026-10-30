import { openPackSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { openPacks } from "@/server/services/packs";

export const POST = route<{ id: string }>(
  { auth: "user", rateLimit: { name: "open-pack", limit: 40, windowMs: 60_000 } },
  async ({ req, params, user }) => {
    const input = await parseJson(req, openPackSchema);
    return openPacks({ userId: user.id, pack: params.id, quantity: input.quantity, idempotencyKey: input.idempotencyKey, useVoucher: input.useVoucher });
  },
);
