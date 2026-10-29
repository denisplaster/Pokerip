import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

export type Tx = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // The adapter connects lazily, so importing this module never requires a live
  // database (e.g. during `next build`).
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  return new PrismaClient({
    adapter,
    log: process.env.PRISMA_LOG_QUERIES === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function isRetryable(error: unknown) {
  const e = error as { code?: string; message?: string; cause?: { code?: string } };
  if (e?.code === "P2034") return true;
  const pgCode = e?.cause?.code;
  if (pgCode === "40P01" || pgCode === "40001") return true;
  const msg = String(e?.message ?? "");
  return msg.includes("deadlock detected") || msg.includes("could not serialize access");
}

/**
 * Runs `fn` in an interactive transaction, retrying a couple of times on
 * deadlocks / serialization failures. All balance-changing work goes through here.
 */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>, opts: { timeout?: number } = {}): Promise<T> {
  const attempts = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { maxWait: 10_000, timeout: opts.timeout ?? 30_000 });
    } catch (error) {
      if (attempt < attempts && isRetryable(error)) {
        await new Promise((r) => setTimeout(r, 25 * attempt + Math.random() * 50));
        continue;
      }
      throw error;
    }
  }
}

export function isUniqueViolation(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string }; message?: string };
  return e?.code === "P2002" || e?.cause?.code === "23505" || String(e?.message ?? "").includes("Unique constraint");
}
