import { route } from "@/server/api";
import { buyListing } from "@/server/services/marketplace";

export const POST = route<{ id: string }>({ auth: "user", rateLimit: { name: "buy", limit: 30, windowMs: 60_000 } }, async ({ params, user }) =>
  buyListing(user.id, params.id),
);
