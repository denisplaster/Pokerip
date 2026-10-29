import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/server/rate-limit";
import { createUser, seedFixture } from "./fixtures";

// Route handlers resolve the signed-in user through Auth.js; stub just that call.
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock("@/auth", () => ({
  auth: async () => session.current,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
  oauthProviders: [],
}));

const { POST: openRoute } = await import("@/app/api/packs/[id]/open/route");
const { GET: adminStats } = await import("@/app/api/admin/stats/route");
const { POST: registerRoute } = await import("@/app/api/register/route");
const { GET: walletRoute } = await import("@/app/api/wallet/route");

function req(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? "GET",
    headers: { host: "localhost:3000", ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) },
    body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
  });
}
const ctx = <P,>(params: P) => ({ params: Promise.resolve(params) });

beforeEach(async () => {
  await seedFixture();
  session.current = null;
  resetRateLimits();
});

describe("HTTP API guards", () => {
  it("requires authentication for gameplay endpoints", async () => {
    const res = await openRoute(req("/api/packs/test-pack/open", { method: "POST", body: { quantity: 1, idempotencyKey: "abcdefgh12" } }), ctx({ id: "test-pack" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("opens a pack for an authenticated user and validates input", async () => {
    const user = await createUser({ balance: 1_000 });
    session.current = { user: { id: user.id } };
    const bad = await openRoute(req("/api/packs/test-pack/open", { method: "POST", body: { quantity: 3, idempotencyKey: "abcdefgh12" } }), ctx({ id: "test-pack" }));
    expect(bad.status).toBe(422);
    const ok = await openRoute(req("/api/packs/test-pack/open", { method: "POST", body: { quantity: 1, idempotencyKey: "abcdefgh12" } }), ctx({ id: "test-pack" }));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.packs[0].cards).toHaveLength(5);
    const wallet = await (await walletRoute(req("/api/wallet"), ctx({}))).json();
    expect(wallet.balance).toBe(body.balance);
  });

  it("rejects cross-site and non-JSON state-changing requests", async () => {
    const user = await createUser({ balance: 1_000 });
    session.current = { user: { id: user.id } };
    const cross = await openRoute(
      req("/api/packs/test-pack/open", { method: "POST", body: { quantity: 1, idempotencyKey: "abcdefgh12" }, headers: { origin: "https://evil.example" } }),
      ctx({ id: "test-pack" }),
    );
    expect(cross.status).toBe(403);
    const form = await openRoute(
      req("/api/packs/test-pack/open", { method: "POST", body: "quantity=1", headers: { "content-type": "text/plain" } }),
      ctx({ id: "test-pack" }),
    );
    expect(form.status).toBe(400);
  });

  it("restricts admin endpoints to administrators", async () => {
    const user = await createUser();
    session.current = { user: { id: user.id } };
    expect((await adminStats(req("/api/admin/stats"), ctx({}))).status).toBe(403);
    const admin = await createUser({ role: "ADMIN" });
    session.current = { user: { id: admin.id } };
    expect((await adminStats(req("/api/admin/stats"), ctx({}))).status).toBe(200);
  });

  it("treats suspended accounts as signed out", async () => {
    const user = await createUser();
    const { prisma } = await import("@/server/db");
    await prisma.user.update({ where: { id: user.id }, data: { suspendedAt: new Date() } });
    session.current = { user: { id: user.id } };
    expect((await walletRoute(req("/api/wallet"), ctx({}))).status).toBe(401);
  });

  it("rate-limits registration", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await registerRoute(
        req("/api/register", { method: "POST", body: { username: `rl_user_${i}`, email: `rl${i}@test.dev`, password: "password123", acceptTerms: true }, headers: { "x-forwarded-for": "203.0.113.9" } }),
        ctx({}),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });

  it("requires explicit acceptance that the currency is fictional", async () => {
    const res = await registerRoute(req("/api/register", { method: "POST", body: { username: "nofine", email: "n@test.dev", password: "password123", acceptTerms: false } }), ctx({}));
    expect(res.status).toBe(422);
  });
});
