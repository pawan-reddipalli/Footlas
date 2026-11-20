"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { onSoundChange, play, setSoundEnabled, soundEnabled } from "@/lib/feedback";

const noop = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

const iconButton =
  "relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-surface text-foreground transition-colors hover:border-pitch";

/** Dark mode is "floodlights on". The icon is a floodlight pylon that switches its lamps. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={() => {
        play("tap");
        setTheme(dark ? "light" : "dark");
      }}
      className={iconButton}
      aria-label={dark ? "Switch to matchday (light) mode" : "Switch to floodlit (dark) mode"}
      title={dark ? "Floodlights off" : "Floodlights on"}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 21V11M8.5 21h7" />
        <rect x="6" y="3.5" width="12" height="7" rx="1.5" />
        {[9, 12, 15].map((cx) => (
          <motion.circle
            key={cx}
            cx={cx}
            cy={7}
            r={1.4}
            animate={{ fill: dark ? "var(--pick)" : "transparent", scale: dark ? 1 : 0.7 }}
            transition={{ delay: (cx - 9) * 0.02 }}
          />
        ))}
      </svg>
      <AnimatePresence>
        {dark && (
          <motion.span
            key="beam"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: "inset 0 0 12px var(--pick)" }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** A referee's whistle: blows when switched on, crossed out when muted. */
export function SoundToggle() {
  const enabled = useSyncExternalStore(
    (notify) => onSoundChange(notify),
    soundEnabled,
    () => true,
  );
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={() => {
        setSoundEnabled(!enabled);
        if (!enabled) setTimeout(() => play("whistle"), 0);
      }}
      className={iconButton}
      aria-label="Sound"
      aria-pressed={enabled}
      title={enabled ? "Sound on" : "Sound off"}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5h9.5l5-3.5v4A5 5 0 1 1 8 13.8" />
        <circle cx="13" cy="15" r="2" />
        <AnimatePresence>
          {!enabled && (
            <motion.path
              d="M4 4l16 16"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              exit={{ pathLength: 0 }}
              stroke="var(--danger)"
            />
          )}
        </AnimatePresence>
      </svg>
    </motion.button>
  );
}
