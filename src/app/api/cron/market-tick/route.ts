import { timingSafeEqual } from "node:crypto";
import { route } from "@/server/api";
import { AppError } from "@/server/errors";
import { runMarketTick } from "@/server/services/market";

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Scheduled fictional market simulation. Vercel Cron calls this with
 * `Authorization: Bearer $CRON_SECRET` (see vercel.json); any scheduler can.
 */
export const GET = route({ auth: "none" }, async ({ req }) => {
  if (!authorized(req.headers.get("authorization"))) throw new AppError("UNAUTHORIZED", "Invalid cron credentials.");
  return runMarketTick();
});
