import { adminUserUpdateSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { getUserAdminDetail, updateUserAdmin } from "@/server/services/admin";

export const GET = route<{ id: string }>({ auth: "admin" }, async ({ params }) => getUserAdminDetail(params.id));

export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, user }) => updateUserAdmin(user.id, params.id, await parseJson(req, adminUserUpdateSchema)));
