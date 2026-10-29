import { sellDuplicatesSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { sellDuplicates } from "@/server/services/collection";

export const POST = route({ auth: "user", rateLimit: { name: "sell-dupes", limit: 10, windowMs: 60_000 } }, async ({ req, user }) => {
  const { rarities, keep } = await parseJson(req, sellDuplicatesSchema);
  return sellDuplicates(user.id, rarities, keep);
});
