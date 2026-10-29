import { createListingSchema, listingsQuerySchema } from "@/lib/validators";
import { parseJson, parseSearch, route } from "@/server/api";
import { createListing, searchListings } from "@/server/services/marketplace";

export const GET = route({ auth: "none" }, async ({ req }) => searchListings(parseSearch(req, listingsQuerySchema)));

export const POST = route({ auth: "user", rateLimit: { name: "list", limit: 30, windowMs: 60_000 } }, async ({ req, user }) => {
  const { userCardId, price } = await parseJson(req, createListingSchema);
  return createListing(user.id, userCardId, price);
});
