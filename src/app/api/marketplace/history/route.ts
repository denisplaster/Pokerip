import { z } from "zod";
import { parseSearch, route } from "@/server/api";
import { getSaleHistory } from "@/server/services/marketplace";

const query = z.object({ mine: z.enum(["1", "0"]).optional(), cardId: z.string().max(64).optional(), limit: z.coerce.number().int().min(1).max(100).default(40) });

export const GET = route({ auth: "optional" }, async ({ req, user }) => {
  const q = parseSearch(req, query);
  return { items: await getSaleHistory({ userId: q.mine === "1" && user ? user.id : undefined, cardId: q.cardId, limit: q.limit, viewerId: user?.id }) };
});
