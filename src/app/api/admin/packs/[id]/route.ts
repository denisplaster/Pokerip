import { adminPackSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { getPackAdmin, savePackDetails } from "@/server/services/admin";

export const GET = route<{ id: string }>({ auth: "admin" }, async ({ params }) => getPackAdmin(params.id));

export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, user }) => savePackDetails(user.id, params.id, await parseJson(req, adminPackSchema)));
