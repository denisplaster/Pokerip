import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { oauthProviders } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirect } from "@/lib/safe-redirect";
import { getSessionUser } from "@/server/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const params = await searchParams;
  const callbackUrl = safeRedirect(params.callbackUrl);
  if (await getSessionUser()) redirect(callbackUrl);
  const error = params.error ? "Sign-in failed. Please try again." : null;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to keep ripping.">
      <LoginForm callbackUrl={callbackUrl} providers={oauthProviders} initialError={error} />
    </AuthShell>
  );
}
