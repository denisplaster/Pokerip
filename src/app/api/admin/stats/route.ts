import { z } from "zod";
import { parseSearch, route } from "@/server/api";
import { getAdminStats } from "@/server/services/admin";

const query = z.object({ days: z.coerce.number().int().min(7).max(90).default(30) });

export const GET = route({ auth: "admin" }, async ({ req }) => getAdminStats(parseSearch(req, query).days));
