"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";

/** Theme (Matchday light / Floodlit dark) and motion defaults for the whole app. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 420, damping: 30 }}>
        {children}
      </MotionConfig>
    </ThemeProvider>
  );
}
