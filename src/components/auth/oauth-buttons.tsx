"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function OAuthButtons({ providers, callbackUrl }: { providers: { id: string; name: string }[]; callbackUrl: string }) {
  if (!providers.length) return null;
  return (
    <div className="space-y-3">
      <div className="relative py-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
        <span className="relative z-10 bg-card px-3">or continue with</span>
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((p) => (
          <Button key={p.id} variant="outline" type="button" onClick={() => signIn(p.id, { redirectTo: callbackUrl })}>
            {p.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
