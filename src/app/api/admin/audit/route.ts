import { route } from "@/server/api";
import { listAuditLog } from "@/server/services/admin";

export const GET = route({ auth: "admin" }, async () => ({ items: await listAuditLog(100) }));
