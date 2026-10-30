"use client";

import { Gift, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api-client";
import { registerSchema } from "@/lib/validators";
import { OAuthButtons } from "./oauth-buttons";

type FieldErrors = Partial<Record<"username" | "email" | "password" | "acceptTerms", string>>;

export function RegisterForm({ callbackUrl, providers }: { callbackUrl: string; providers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = {
      username: String(form.get("username") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      acceptTerms: accepted,
    };
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    try {
      await api("/api/register", { body: parsed.data });
      const res = await signIn("credentials", { identifier: parsed.data.username, password: parsed.data.password, redirect: false });
      if (!res || res.error) throw new Error("Account created — please sign in.");
      router.push(callbackUrl === "/" ? "/packs?welcome=1" : callbackUrl);
      router.refresh();
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && (err.details as { field?: keyof FieldErrors } | null)?.field) {
        setErrors({ [(err.details as { field: keyof FieldErrors }).field]: err.message });
      } else {
        setFormError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3 text-sm text-amber-100">
        <Gift className="size-5 shrink-0 text-amber-300" />
        <p>
          Every new collector starts with <strong>10,000 Rip Coins</strong> — free, fictional, and never for sale.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Field id="username" label="Username" error={errors.username}>
          <Input id="username" name="username" autoComplete="username" aria-invalid={Boolean(errors.username)} maxLength={20} required autoFocus />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} required />
        </Field>
        <Field id="password" label="Password" error={errors.password} hint="At least 8 characters with a letter and a number.">
          <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} required />
        </Field>
        <div className="space-y-1">
          <div className="flex items-start gap-3">
            <Checkbox id="acceptTerms" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} aria-invalid={Boolean(errors.acceptTerms)} className="mt-0.5" />
            <Label htmlFor="acceptTerms" className="text-sm font-normal leading-snug text-muted-foreground">
              I understand Rip Coins and cards are fictional, cannot be purchased, and have no real-world value.
            </Label>
          </div>
          {errors.acceptTerms && <p className="text-xs text-red-300">{errors.acceptTerms}</p>}
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />} Create account
        </Button>
      </form>
      <OAuthButtons providers={providers} callbackUrl={callbackUrl} />
      <p className="text-center text-sm text-muted-foreground">
        Already collecting?{" "}
        <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="font-semibold text-violet-300 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-300">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
