"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { ProgressNotice } from "@/lib/notices";
import { playSound } from "@/lib/sound";

/** Shows achievement / level-up / mission toasts returned by mutations. */
export function useShowNotices() {
  return useCallback((notices: ProgressNotice[] | undefined) => {
    if (!notices?.length) return;
    notices.forEach((n, i) => {
      setTimeout(() => {
        if (n.kind === "LEVEL_UP" || n.kind === "ACHIEVEMENT") playSound("coin");
        const icon = n.kind === "LEVEL_UP" ? "⬆️" : n.kind === "ACHIEVEMENT" ? "🏆" : n.kind === "SET_COMPLETE" ? "📚" : "✅";
        toast.success(`${icon} ${n.title}`, { description: n.description, duration: 6000 });
      }, 400 + i * 700);
    });
  }, []);
}
