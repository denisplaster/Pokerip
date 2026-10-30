"use client";

import { animate, useMotionValue, useTransform, motion } from "framer-motion";
import { useEffect } from "react";

/** Smoothly animates between numeric values (used for balances and totals). */
export function AnimatedNumber({ value, format = (n: number) => Math.round(n).toLocaleString("en-US"), duration = 0.8, className }: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [mv, value, duration]);
  return <motion.span className={className}>{text}</motion.span>;
}
