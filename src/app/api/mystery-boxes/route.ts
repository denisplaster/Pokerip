import { route } from "@/server/api";
import { listBoxes } from "@/server/services/mystery-boxes";

export const GET = route({ auth: "none" }, async () => ({ boxes: await listBoxes() }));
