"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/lib/validators";
import { OAuthButtons } from "./oauth-buttons";

export function LoginForm({ callbackUrl, providers, initialError }: { callbackUrl: string; providers: { id: string; name: string }[]; initialError?: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ identifier: form.get("identifier"), password: form.get("password") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await signIn("credentials", { ...parsed.data, redirect: false });
    if (!res || res.error) {
      setPending(false);
      setError("Invalid email/username or password. (Too many attempts? Wait a few minutes.)");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="identifier">Email or username</Label>
          <Input id="identifier" name="identifier" autoComplete="username" required autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />} Sign in
        </Button>
      </form>
      <OAuthButtons providers={providers} callbackUrl={callbackUrl} />
      <p className="text-center text-sm text-muted-foreground">
        New to RipVault?{" "}
        <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="font-semibold text-violet-300 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
