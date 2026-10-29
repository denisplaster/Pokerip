"use client";

import { useNow } from "@/hooks/use-now";
import { formatDuration } from "@/lib/format";

export function Countdown({ to, prefix = "Resets in" }: { to: string | null; prefix?: string }) {
  const now = useNow(1000);
  if (!to || now === null) return <span className="tabular">&nbsp;</span>;
  return (
    <span className="tabular">
      {prefix} {formatDuration(new Date(to).getTime() - now)}
    </span>
  );
}
