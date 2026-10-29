import { route } from "@/server/api";
import { getCopies } from "@/server/services/collection";

export const GET = route<{ id: string }>({ auth: "user" }, async ({ params, user }) => ({ copies: await getCopies(user.id, params.id) }));
