"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <TriangleAlert className="size-12 text-amber-300" />
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground">An unexpected error occurred. Your Rip Coins are safe — every transaction is all-or-nothing.</p>
      {error.digest && <code className="text-xs text-muted-foreground">Reference: {error.digest}</code>}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
