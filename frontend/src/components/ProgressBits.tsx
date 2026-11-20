"use client";

import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

import { play } from "@/lib/feedback";
import type { Progress, UnlockedAchievement } from "@/lib/types";

import { HEX_COUNT } from "./ball/geometry";

/** Levels climb the football pyramid, so progress tells a story rather than a number. */
const TIERS = [
  "Sunday League",
  "Sunday League",
  "Non-League",
  "Non-League",
  "Lower League",
  "Lower League",
  "Championship",
  "Championship",
  "Top Flight",
  "Top Flight",
  "Continental",
  "Continental",
];
export function levelName(level: number) {
  return TIERS[level - 1] ?? "Ballon d'Or";
}

/** How many of the football's 20 hexagon panels this progress has stitched in. */
export function panelsFilled(progress: Progress | undefined) {
  if (!progress || progress.xp_for_next <= 0) return 0;
  return Math.floor((HEX_COUNT * progress.xp_into_level) / progress.xp_for_next);
}

/** A number that rolls to its new value like a scoreboard. */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const shown = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span className={`tabular ${className ?? ""}`}>{shown}</motion.span>;
}

export function XpBar({ progress }: { progress: Progress }) {
  const filled = panelsFilled(progress);
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="leading-tight">
          <p className="font-display text-2xl font-black uppercase">
            Level <RollingNumber value={progress.level} />
          </p>
          <p className="text-sm text-muted">{levelName(progress.level)}</p>
        </div>
        <p className="text-right text-sm text-muted">
          <RollingNumber value={progress.xp_into_level} className="font-semibold text-foreground" />{" "}
          / {progress.xp_for_next} XP
        </p>
      </div>
      {/* Twenty notches, one per hexagon panel on the ball. */}
      <div
        className="flex gap-[3px]"
        role="progressbar"
        aria-label={`Level ${progress.level} progress`}
        aria-valuenow={progress.xp_into_level}
        aria-valuemin={0}
        aria-valuemax={progress.xp_for_next}
      >
        {Array.from({ length: HEX_COUNT }, (_, i) => (
          <motion.span
            key={i}
            className="h-3 flex-1 rounded-[3px] bg-surface-muted"
            initial={false}
            animate={{
              backgroundColor: i < filled ? "var(--gold)" : "var(--surface-muted)",
              scaleY: i === filled - 1 ? [1, 1.6, 1] : 1,
            }}
            transition={{ delay: i * 0.025, duration: 0.4 }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The streak is a scarf that gains a stripe every day you play. Long streaks wrap into
 * the club colours instead of a number with a flame.
 */
export function StreakBadge({ streak }: { streak: number }) {
  const stripes = Math.min(Math.max(streak, 0), 14);
  return (
    <div
      className="inline-flex items-center gap-3 rounded-full border border-border bg-surface py-1 pr-4 pl-1"
      title="Daily challenge streak"
    >
      <svg viewBox="0 0 120 28" className="h-7 w-[104px]" aria-hidden>
        <g>
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`l${i}`} x1="3" x2="9" y1={5 + i * 3.6} y2={5 + i * 3.6} stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" />
          ))}
          <rect x="9" y="3" width="102" height="22" rx="3" fill="var(--surface-muted)" />
          {Array.from({ length: stripes }, (_, i) => (
            <motion.rect
              key={i}
              x={9 + i * (102 / 14)}
              y="3"
              width={102 / 14 + 0.5}
              height="22"
              fill={i % 2 === 0 ? "var(--pitch)" : "var(--gold)"}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ originY: 0.5 }}
              transition={{ delay: 0.15 + i * 0.05, type: "spring", stiffness: 400, damping: 18 }}
            />
          ))}
          {streak > 0 && (
            <rect x="9" y="3" width="102" height="22" rx="3" fill="none" stroke="rgb(0 0 0 / 0.12)" />
          )}
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`r${i}`} x1="111" x2="117" y1={5 + i * 3.6} y2={5 + i * 3.6} stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" />
          ))}
        </g>
      </svg>
      <span className="leading-none">
        <span className="font-score text-xl font-black">{streak}</span>
        <span className="ml-1 text-xs text-muted">day{streak === 1 ? "" : "s"}</span>
      </span>
    </div>
  );
}

/** Enamel pin badges that spring in when an achievement unlocks. */
export function UnlockedToast({ achievements }: { achievements: UnlockedAchievement[] }) {
  const key = achievements.map((a) => a.slug).join(",");
  useEffect(() => {
    if (key) play("unlock");
  }, [key]);
  return (
    <div className="space-y-2" aria-live="polite">
      <AnimatePresence>
        {achievements.map((a, i) => (
          <motion.div
            key={a.slug}
            initial={{ opacity: 0, y: 24, rotate: -4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 20, delay: i * 0.12 }}
            className="sticker flex items-center gap-4 rounded-2xl px-4 py-3"
          >
            <PinBadge emoji={a.emoji} unlocked />
            <div>
              <p className="font-display text-lg leading-tight font-black uppercase">
                Unlocked: {a.name}
              </p>
              <p className="text-sm text-muted">{a.description}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function PinBadge({
  emoji,
  unlocked,
  size = "md",
}: {
  emoji: string;
  unlocked: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "sm" ? "h-11 w-11 text-xl" : size === "lg" ? "h-16 w-16 text-3xl" : "h-12 w-12 text-2xl";
  return (
    <motion.span
      whileHover={unlocked ? { rotate: [0, -8, 6, 0], scale: 1.08 } : undefined}
      className={`relative flex shrink-0 items-center justify-center rounded-full ${dims} ${
        unlocked
          ? "bg-gold-soft shadow-[inset_0_-3px_0_rgb(0_0_0/0.18),0_0_0_3px_var(--gold),0_6px_14px_-6px_rgb(var(--shadow)/0.6)]"
          : "bg-surface-muted opacity-60 grayscale shadow-[inset_0_2px_4px_rgb(0_0_0/0.15)]"
      }`}
      aria-hidden
    >
      <span className={unlocked ? "" : "opacity-40"}>{emoji}</span>
      {unlocked && (
        <span className="pointer-events-none absolute inset-1 rounded-full bg-gradient-to-br from-white/50 via-transparent to-transparent" />
      )}
    </motion.span>
  );
}
