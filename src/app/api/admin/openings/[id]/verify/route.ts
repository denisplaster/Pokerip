import { route } from "@/server/api";
import { verifyOpening } from "@/server/services/packs";

export const GET = route<{ id: string }>({ auth: "admin" }, async ({ params }) => verifyOpening(params.id));
