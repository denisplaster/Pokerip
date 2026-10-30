import { favoriteSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { setFavorite } from "@/server/services/collection";

export const POST = route({ auth: "user", rateLimit: { name: "favorite", limit: 120, windowMs: 60_000 } }, async ({ req, user }) => {
  const { cardId, favorite } = await parseJson(req, favoriteSchema);
  return setFavorite(user.id, cardId, favorite);
});
