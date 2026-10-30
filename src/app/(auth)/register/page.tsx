import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { oauthProviders } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { safeRedirect } from "@/lib/safe-redirect";
import { getSessionUser } from "@/server/session";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const params = await searchParams;
  const callbackUrl = safeRedirect(params.callbackUrl);
  if (await getSessionUser()) redirect(callbackUrl);
  return (
    <AuthShell title="Create your vault" subtitle="Free to play. 10,000 Rip Coins on us.">
      <RegisterForm callbackUrl={callbackUrl} providers={oauthProviders} />
    </AuthShell>
  );
}
