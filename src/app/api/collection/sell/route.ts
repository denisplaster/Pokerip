import { sellCardsSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { sellCards } from "@/server/services/collection";

export const POST = route({ auth: "user", rateLimit: { name: "sell", limit: 60, windowMs: 60_000 } }, async ({ req, user }) => {
  const { userCardIds } = await parseJson(req, sellCardsSchema);
  return sellCards(user.id, userCardIds);
});
