"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Scissors } from "lucide-react";
import { useState } from "react";
import { PackArt } from "@/components/packs/pack-art";
import { packTheme } from "@/components/packs/pack-themes";
import { cn } from "@/lib/utils";
import { Burst } from "./burst";

export type StagePhase = "ready" | "charging" | "tearing";

/**
 * The pack in the centre of the screen. Tap it, press the button, or swipe
 * across the tear strip to open. While the server request is in flight the
 * pack shakes; once results are back it tears apart with a particle burst.
 */
export function PackStage({
  theme,
  name,
  cards,
  phase,
  onTear,
  disabled,
}: {
  theme: string;
  name: string;
  cards: number;
  phase: StagePhase;
  onTear: () => void;
  disabled?: boolean;
}) {
  const t = packTheme(theme);
  const [drag, setDrag] = useState(0);

  function onPan(_: unknown, info: PanInfo) {
    if (phase !== "ready" || disabled) return;
    setDrag(Math.min(1, Math.abs(info.offset.x) / 140));
  }

  function onPanEnd(_: unknown, info: PanInfo) {
    if (phase !== "ready" || disabled) return;
    if (Math.abs(info.offset.x) > 120 && Math.abs(info.offset.y) < 120) onTear();
    setDrag(0);
  }

  return (
    <div className="relative flex h-[420px] w-full items-center justify-center sm:h-[500px]">
      {/* aura */}
      <motion.div
        className="absolute size-[340px] rounded-full blur-3xl sm:size-[420px]"
        style={{ background: `radial-gradient(circle, ${t.glow}, transparent 65%)` }}
        animate={{ opacity: phase === "charging" ? [0.45, 0.95, 0.45] : phase === "tearing" ? 0 : 0.35, scale: phase === "charging" ? [1, 1.15, 1] : 1 }}
        transition={{ duration: phase === "charging" ? 0.8 : 0.5, repeat: phase === "charging" ? Infinity : 0 }}
        aria-hidden
      />

      <AnimatePresence>
        {phase !== "tearing" ? (
          <motion.div
            key="pack"
            className="relative w-[230px] touch-pan-y sm:w-[280px]"
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.01 } }}
            onPan={onPan}
            onPanEnd={onPanEnd}
          >
            <button
              type="button"
              onClick={onTear}
              disabled={phase !== "ready" || disabled}
              aria-label={`Tear open ${name}`}
              className={cn("block w-full rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-ring/60", phase === "ready" && !disabled && "cursor-pointer")}
            >
              <div className={cn(phase === "ready" && "animate-float", phase === "charging" && "animate-shake")}>
                <PackArt theme={theme} name={name} cards={cards} />
              </div>
            </button>
            {phase === "ready" && (
              <div className="pointer-events-none absolute inset-x-[4%] top-[8.5%] flex items-center gap-2" aria-hidden>
                <Scissors className="size-4 text-white/80 drop-shadow" style={{ transform: `translateX(${drag * 160}px)` }} />
                <div className="h-px flex-1 border-t-2 border-dashed border-white/50" style={{ clipPath: `inset(0 0 0 ${drag * 100}%)` }} />
              </div>
            )}
            {phase === "charging" && <Burst colors={[t.glow, "#ffffff", t.via]} count={14} distance={120} size={4} duration={1.2} />}
          </motion.div>
        ) : (
          <motion.div key="torn" className="relative w-[230px] sm:w-[280px]" aria-hidden>
            {/* Top strip flies away. */}
            <motion.div
              className="absolute inset-0"
              style={{ clipPath: "inset(0 0 86% 0)" }}
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
              animate={{ x: 160, y: -220, rotate: 28, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.3, 0, 0.2, 1] }}
            >
              <PackArt theme={theme} name={name} cards={cards} shine={false} />
            </motion.div>
            {/* Body drops and fades as the cards come out. */}
            <motion.div
              style={{ clipPath: "inset(14% 0 0 0)" }}
              initial={{ y: 0, opacity: 1, scale: 1 }}
              animate={{ y: 180, opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.85, delay: 0.15, ease: [0.4, 0, 1, 1] }}
            >
              <PackArt theme={theme} name={name} cards={cards} shine={false} />
            </motion.div>
            <motion.div
              className="absolute inset-x-0 top-[10%] h-24 rounded-full bg-white blur-2xl"
              initial={{ opacity: 0.9, scale: 0.4 }}
              animate={{ opacity: 0, scale: 2.2 }}
              transition={{ duration: 0.7 }}
            />
            <div className="absolute inset-x-0 top-[12%]">
              <Burst colors={[t.glow, "#ffffff", t.via, "#fde68a"]} count={40} distance={220} size={7} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
