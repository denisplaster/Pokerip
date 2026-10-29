import { z } from "zod";
import { RARITIES } from "@/lib/rarity";
import { adminCardSchema } from "@/lib/validators";
import { parseJson, parseSearch, route } from "@/server/api";
import { listCardsAdmin, saveCard } from "@/server/services/admin";

const query = z.object({
  q: z.string().trim().max(60).optional(),
  rarity: z.enum(RARITIES).optional(),
  setId: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const GET = route({ auth: "admin" }, async ({ req }) => listCardsAdmin(parseSearch(req, query)));

export const POST = route({ auth: "admin" }, async ({ req, user }) => saveCard(user.id, null, await parseJson(req, adminCardSchema)));
