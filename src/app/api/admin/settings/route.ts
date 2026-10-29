import { adminSettingsSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { saveSystemSettings } from "@/server/services/admin";
import { getSettings, invalidateSettingsCache } from "@/server/services/settings";

export const GET = route({ auth: "admin" }, async () => {
  invalidateSettingsCache();
  return getSettings();
});

export const PUT = route({ auth: "admin" }, async ({ req, user }) => saveSystemSettings(user.id, await parseJson(req, adminSettingsSchema)));
