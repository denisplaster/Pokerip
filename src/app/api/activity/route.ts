import { z } from "zod";
import { parseSearch, route } from "@/server/api";
import { listActivity } from "@/server/services/activity";

const query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum(["pulls", "all"]).default("all"),
});

export const GET = route({ auth: "none" }, async ({ req }) => {
  const q = parseSearch(req, query);
  return { items: await listActivity({ limit: q.limit, types: q.type === "pulls" ? ["BIG_PULL", "MYSTERY_BOX_WIN"] : undefined }) };
});
