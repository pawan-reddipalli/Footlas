"use client";

/** Confetti in the theme's own colours, loaded only when something is worth celebrating. */
export async function confettiBurst(kind: "level" | "perfect" = "level") {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { default: confetti } = await import("canvas-confetti");
  const css = getComputedStyle(document.documentElement);
  const colors = ["--pitch", "--gold", "--pick", "--surface"].map((v) => css.getPropertyValue(v).trim());
  const base = { colors, disableForReducedMotion: true, ticks: 220, scalar: 1.05 };
  if (kind === "perfect") {
    confetti({ ...base, particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.75 } });
    confetti({ ...base, particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.75 } });
  } else {
    confetti({ ...base, particleCount: 140, spread: 100, startVelocity: 42, origin: { y: 0.6 } });
  }
}
