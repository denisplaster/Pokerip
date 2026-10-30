import { route } from "@/server/api";
import { cancelListing } from "@/server/services/marketplace";

export const DELETE = route<{ id: string }>({ auth: "user", rateLimit: { name: "cancel-listing", limit: 60, windowMs: 60_000 } }, async ({ params, user }) =>
  cancelListing(user.id, params.id),
);
