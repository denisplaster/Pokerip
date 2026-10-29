import { prisma } from "@/server/db";
import { route } from "@/server/api";

export const GET = route({ auth: "admin" }, async () => ({
  sets: await prisma.cardSet.findMany({ orderBy: [{ releaseYear: "asc" }, { name: "asc" }], select: { id: true, code: true, name: true, releaseYear: true } }),
}));
