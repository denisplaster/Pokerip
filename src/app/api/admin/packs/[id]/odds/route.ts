import { adminOddsSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { savePackOdds } from "@/server/services/admin";

export const PUT = route<{ id: string }>({ auth: "admin" }, async ({ req, params, user }) => savePackOdds(user.id, params.id, await parseJson(req, adminOddsSchema)));
