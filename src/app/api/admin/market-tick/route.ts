import { route } from "@/server/api";
import { audit } from "@/server/services/admin";
import { prisma } from "@/server/db";
import { runMarketTick } from "@/server/services/market";

export const POST = route({ auth: "admin", rateLimit: { name: "admin-tick", limit: 10, windowMs: 60_000 } }, async ({ user }) => {
  const result = await runMarketTick({ dtDays: 1 });
  await prisma.$transaction((tx) => audit(tx, user.id, "market.tick", "Market", null, { changed: result.changed, cards: result.cards }));
  return result;
});
