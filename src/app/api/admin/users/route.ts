import { z } from "zod";
import { parseSearch, route } from "@/server/api";
import { listUsers } from "@/server/services/admin";

const query = z.object({ q: z.string().trim().max(60).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });

export const GET = route({ auth: "admin" }, async ({ req }) => listUsers(parseSearch(req, query)));
