import { route } from "@/server/api";
import { getWalletState } from "@/server/services/session-state";

export const GET = route({ auth: "user" }, async ({ user }) => getWalletState(user.id));
