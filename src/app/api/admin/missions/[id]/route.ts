import { adminMissionSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { updateMission } from "@/server/services/admin";

export const PATCH = route<{ id: string }>({ auth: "admin" }, async ({ req, params, user }) => updateMission(user.id, params.id, await parseJson(req, adminMissionSchema)));
