import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "./db";
import { forbidden, unauthorized } from "./errors";

export interface SessionUser {
  id: string;
  username: string;
  email: string | null;
  role: "USER" | "ADMIN";
  avatar: string;
  image: string | null;
  level: number;
  xp: number;
}

/**
 * Returns the signed-in user, re-validated against the database on every
 * request (so suspensions and role changes take effect immediately).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, email: true, role: true, avatar: true, image: true, level: true, xp: true, suspendedAt: true, isBot: true, sessionVersion: true },
  });
  if (!user || user.suspendedAt || user.isBot) return null;
  // Sessions issued before the latest password change are no longer valid.
  if ((session.user.sessionVersion ?? 0) !== user.sessionVersion) return null;
  const { suspendedAt: _s, isBot: _b, sessionVersion: _v, ...rest } = user;
  return rest;
});

/** For server components/pages: redirects to the login page when signed out. */
export async function requireUser(callbackUrl?: string) {
  const user = await getSessionUser();
  if (!user) redirect(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login");
  return user;
}

/** For server components/pages: only administrators may continue. */
export async function requireAdminPage() {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** For API routes. */
export async function requireApiUser() {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireApiAdmin() {
  const user = await requireApiUser();
  if (user.role !== "ADMIN") throw forbidden("Administrator access required.");
  return user;
}
