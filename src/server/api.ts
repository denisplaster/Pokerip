import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { OddsConfigError } from "@/lib/probability";
import { isUniqueViolation } from "./db";
import { AppError } from "./errors";
import { rateLimit } from "./rate-limit";
import { requireApiAdmin, requireApiUser, getSessionUser, type SessionUser } from "./session";

type AuthMode = "user" | "admin" | "optional" | "none";

interface RouteOptions<A extends AuthMode> {
  auth: A;
  /** Requests per window per user (or per IP for anonymous routes). */
  rateLimit?: { limit: number; windowMs: number; name: string };
}

interface HandlerArgs<P, U> {
  req: NextRequest;
  params: P;
  user: U;
}

type RouteHandler<P> = (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Wraps a route handler with authentication, CSRF origin checks, rate limiting
 * and consistent JSON error responses.
 */
export function route<P = Record<string, never>>(
  options: RouteOptions<"user" | "admin">,
  handler: (args: HandlerArgs<P, SessionUser>) => Promise<unknown>,
): RouteHandler<P>;
export function route<P = Record<string, never>>(
  options: RouteOptions<"optional" | "none">,
  handler: (args: HandlerArgs<P, SessionUser | null>) => Promise<unknown>,
): RouteHandler<P>;
export function route<P>(
  options: RouteOptions<AuthMode>,
  handler: (args: HandlerArgs<P, SessionUser>) => Promise<unknown>,
): RouteHandler<P> {
  return async (req, ctx) => {
    try {
      if (MUTATING.has(req.method)) assertSameOrigin(req);
      const params = ctx?.params ? await ctx.params : ({} as P);
      let user: SessionUser | null = null;
      if (options.auth === "user") user = await requireApiUser();
      else if (options.auth === "admin") user = await requireApiAdmin();
      else if (options.auth === "optional") user = await getSessionUser();

      if (options.rateLimit) {
        const who = user?.id ?? clientIp(req);
        rateLimit(`${options.rateLimit.name}:${who}`, options.rateLimit.limit, options.rateLimit.windowMs);
      }

      const result = await handler({ req, params, user: user as SessionUser });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    const headers: Record<string, string> = {};
    const retryAfter = (error.details as { retryAfter?: number } | undefined)?.retryAfter;
    if (error.code === "RATE_LIMITED" && retryAfter) headers["Retry-After"] = String(retryAfter);
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details ?? null } },
      { status: error.status, headers },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: error.issues[0]?.message ?? "Invalid request.",
          details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 422 },
    );
  }
  if (error instanceof OddsConfigError) {
    return NextResponse.json({ error: { code: "VALIDATION", message: error.message, details: error.problems } }, { status: 422 });
  }
  if (isUniqueViolation(error)) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "That action was already processed.", details: null } },
      { status: 409 },
    );
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong. Please try again.", details: null } },
    { status: 500 },
  );
}

export async function parseJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

export function parseSearch<T>(req: NextRequest, schema: ZodType<T>): T {
  const params: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    if (value !== "") params[key] = value;
  });
  return schema.parse(params);
}

/**
 * Rejects cross-site state-changing requests. Browsers always send Origin on
 * POST/PUT/PATCH/DELETE, so a mismatch means another site is submitting the request.
 */
function assertSameOrigin(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (req.method !== "DELETE" && !contentType.includes("application/json")) {
    throw new AppError("BAD_REQUEST", "Expected a JSON request.");
  }
  const origin = req.headers.get("origin");
  if (!origin) return; // Non-browser clients (tests, curl) don't send Origin.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "Invalid request origin.");
  }
  if (!host || originHost !== host) throw new AppError("FORBIDDEN", "Cross-site requests are not allowed.");
}

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anonymous";
}
