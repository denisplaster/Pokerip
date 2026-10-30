import { adminBoxSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { getBoxAdmin, saveBox } from "@/server/services/admin";

export const GET = route<{ id: string }>({ auth: "admin" }, async ({ params }) => getBoxAdmin(params.id));

export const PUT = route<{ id: string }>({ auth: "admin" }, async ({ req, params, user }) => saveBox(user.id, params.id, await parseJson(req, adminBoxSchema)));
