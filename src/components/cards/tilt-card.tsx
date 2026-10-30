"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Pointer-tracking 3D tilt. Also drives the CSS variables used by `.holo-layer`
 * so the holographic sheen follows the cursor / finger.
 */
export function TiltCard({ children, className, max = 14, glare = true }: { children: React.ReactNode; className?: string; max?: number; glare?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 220, damping: 18 });
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 220, damping: 18 });

  function update(clientX: number, clientY: number) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    px.set(x);
    py.set(y);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--bgx", `${30 + x * 40}%`);
    el.style.setProperty("--bgy", `${30 + y * 40}%`);
    if (glare) el.style.setProperty("--holo-opacity", "0.75");
  }

  function reset() {
    px.set(0.5);
    py.set(0.5);
    ref.current?.style.setProperty("--holo-opacity", "0.35");
  }

  return (
    <div className={cn("perspective", className)}>
      <motion.div
        ref={ref}
        style={{ rotateX: rx, rotateY: ry }}
        className="preserve-3d will-change-transform"
        onPointerMove={(e) => update(e.clientX, e.clientY)}
        onPointerLeave={reset}
        onPointerCancel={reset}
      >
        {children}
      </motion.div>
    </div>
  );
}
