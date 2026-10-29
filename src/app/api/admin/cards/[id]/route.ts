import { adminCardSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { removeCard, saveCard } from "@/server/services/admin";

export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, user }) => saveCard(user.id, params.id, await parseJson(req, adminCardSchema)));

export const DELETE = route<{ id: string }>({ auth: "admin" }, async ({ params, user }) => removeCard(user.id, params.id));
