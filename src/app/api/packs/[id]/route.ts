import { route } from "@/server/api";
import { getPackDetail } from "@/server/services/packs";

export const GET = route<{ id: string }>({ auth: "none" }, async ({ params }) => getPackDetail(params.id));
