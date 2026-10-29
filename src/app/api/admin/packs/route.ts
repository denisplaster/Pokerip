import { adminPackSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { listPacksAdmin, savePackDetails } from "@/server/services/admin";

export const GET = route({ auth: "admin" }, async () => ({ packs: await listPacksAdmin() }));

export const POST = route({ auth: "admin" }, async ({ req, user }) => savePackDetails(user.id, null, await parseJson(req, adminPackSchema)));
