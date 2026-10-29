import { route } from "@/server/api";
import { getMyListings } from "@/server/services/marketplace";

export const GET = route({ auth: "user" }, async ({ user }) => getMyListings(user.id));
