import { route } from "@/server/api";
import { listPacks } from "@/server/services/packs";

export const GET = route({ auth: "none" }, async () => ({ packs: await listPacks() }));
