import { adminSimulationSchema } from "@/lib/validators";
import { parseJson, route } from "@/server/api";
import { simulatePackOpenings } from "@/server/services/admin";

export const POST = route({ auth: "admin", rateLimit: { name: "simulate", limit: 10, windowMs: 60_000 } }, async ({ req }) => {
  const { packId, packs } = await parseJson(req, adminSimulationSchema);
  return simulatePackOpenings(packId, packs);
});
