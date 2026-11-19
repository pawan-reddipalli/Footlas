"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { confettiBurst } from "@/lib/celebrate";
import { play } from "@/lib/feedback";
import type { Progress } from "@/lib/types";

import { Football } from "./ball/Football";
import { levelName, panelsFilled } from "./ProgressBits";

/**
 * The scoreboard strip above every game round: a live football that reacts to answers
 * and fills its panels as XP comes in, the round title, and a stat on the right.
 * When a level ticks over it throws the one full-screen celebration in the app.
 */
export function GameHud({
  title,
  subtitle,
  progress,
  right,
}: {
  title: string;
  subtitle?: React.ReactNode;
  progress?: Progress;
  right?: React.ReactNode;
}) {
  const lastLevel = useRef<number | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  useEffect(() => {
    if (!progress) return;
    const prev = lastLevel.current;
    lastLevel.current = progress.level;
    if (prev !== null && progress.level > prev) {
      play("levelUp");
      void confettiBurst("level");
      setLevelUp(progress.level);
      const t = setTimeout(() => setLevelUp(null), 2600);
      return () => clearTimeout(t);
    }
  }, [progress]);

  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface/80 p-2 pr-4 backdrop-blur">
        <Football filled={panelsFilled(progress)} compact className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-2xl leading-none font-black uppercase sm:text-3xl">
            {title}
          </h1>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        {right}
      </div>
      <AnimatePresence>
        {levelUp !== null && (
          <motion.div
            key="level-up"
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLevelUp(null)}
          >
            <motion.div
              className="sticker flex flex-col items-center gap-2 rounded-3xl px-10 py-8 text-center"
              initial={{ scale: 0.6, rotate: -8, y: 40 }}
              animate={{ scale: 1, rotate: 0, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 16 }}
            >
              <span className="text-sm font-semibold text-muted">Promoted!</span>
              <span className="font-display text-6xl leading-none font-black uppercase">
                Level <span className="font-score text-pitch">{levelUp}</span>
              </span>
              <span className="text-lg font-semibold">{levelName(levelUp)}</span>
              <span className="text-sm text-muted">A fresh ball to stitch. Tap to carry on.</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** A small scoreboard readout in the dot-matrix face. */
export function Scoreboard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="font-score text-2xl font-black text-pitch-strong sm:text-3xl">{value}</span>
      <span className="mt-1 text-[11px] font-semibold text-muted">{label}</span>
    </div>
  );
}
