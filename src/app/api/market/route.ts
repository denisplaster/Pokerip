import { route } from "@/server/api";
import { getMarketIndex } from "@/server/services/cards";

export const GET = route({ auth: "none" }, async () => ({ items: await getMarketIndex() }));
