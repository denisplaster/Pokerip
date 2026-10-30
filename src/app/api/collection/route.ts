import { route } from "@/server/api";
import { getCollection } from "@/server/services/collection";

export const GET = route({ auth: "user" }, async ({ user }) => getCollection(user.id));
