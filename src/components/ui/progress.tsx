"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      aria-label={props["aria-label"] ?? (props["aria-labelledby"] ? undefined : "Progress")}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-white/[0.07]", className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full w-full flex-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-500", indicatorClassName)}
        style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value || 0))}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
