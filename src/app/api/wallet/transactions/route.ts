import { z } from "zod";
import { parseSearch, route } from "@/server/api";
import { listTransactions } from "@/server/services/wallet";

const query = z.object({ cursor: z.string().max(64).optional(), limit: z.coerce.number().int().min(1).max(100).default(25) });

export const GET = route({ auth: "user" }, async ({ req, user }) => listTransactions(user.id, parseSearch(req, query)));
