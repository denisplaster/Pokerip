import { route } from "@/server/api";
import { getCardDetail } from "@/server/services/cards";

export const GET = route<{ id: string }>({ auth: "optional" }, async ({ params, user }) => getCardDetail(params.id, user?.id));
