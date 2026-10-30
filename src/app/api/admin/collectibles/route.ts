import { prisma } from "@/server/db";
import { route } from "@/server/api";

export const GET = route({ auth: "admin" }, async () => ({ collectibles: await prisma.collectible.findMany({ orderBy: { value: "asc" } }) }));
