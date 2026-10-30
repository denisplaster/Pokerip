import { z } from "zod";
import { parseSearch, route } from "@/server/api";
import { listTransactionsAdmin } from "@/server/services/admin";

const TYPES = [
  "SIGNUP_BONUS", "PACK_PURCHASE", "MYSTERY_BOX_PURCHASE", "MYSTERY_BOX_REWARD", "CARD_SALE", "MARKETPLACE_PURCHASE",
  "MARKETPLACE_SALE", "DAILY_REWARD", "MISSION_REWARD", "ACHIEVEMENT_REWARD", "LEVEL_UP_REWARD", "ADMIN_ADJUSTMENT",
] as const;

const query = z.object({
  type: z.enum(TYPES).optional(),
  username: z.string().trim().max(40).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const GET = route({ auth: "admin" }, async ({ req }) => listTransactionsAdmin(parseSearch(req, query)));
