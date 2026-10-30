import { adminOddsSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { previewPackOdds } from "@/server/services/admin";

export const POST = route<{ id: string }>({ auth: "admin" }, async ({ req, params }) => {
  const { odds, pool } = await parseJson(req, adminOddsSchema);
  return previewPackOdds(params.id, odds, pool);
});
