import { adminBoxSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { saveBox } from "@/server/services/admin";
import { listBoxes } from "@/server/services/mystery-boxes";

export const GET = route({ auth: "admin" }, async () => ({ boxes: await listBoxes({ includeInactive: true }) }));

export const POST = route({ auth: "admin" }, async ({ req, user }) => saveBox(user.id, null, await parseJson(req, adminBoxSchema)));
