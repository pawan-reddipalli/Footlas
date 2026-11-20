"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { AccountControls } from "@/lib/auth";
import { play } from "@/lib/feedback";

import { FootballMark } from "./ball/FootballMark";
import { SoundToggle, ThemeToggle } from "./Toggles";

const ICONS = {
  daily: (
    <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2.5 2.5 0 0 0 0-5zM14 6v12" />
  ),
  map: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 3.6 5.2 3.6 8.5s-1 6.1-3.6 8.5c-2.6-2.4-3.6-5.2-3.6-8.5s1-6.1 3.6-8.5z" />
    </>
  ),
  players: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.8 3.4-6 7-6s6.2 2.2 7 6" />
      <path d="M10.5 8h.01M13.5 8h.01" />
    </>
  ),
  profile: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 4v16M7 8.5h2M7 12h2M15 8.5h2M15 12h2" />
    </>
  ),
};

const NAV = [
  { href: "/play/daily", label: "Daily", icon: ICONS.daily },
  { href: "/play/map", label: "World Map", icon: ICONS.map },
  { href: "/play/players", label: "Who Am I?", icon: ICONS.players },
  { href: "/profile", label: "Album", icon: ICONS.profile },
];

type Variant = "desktop" | "mobile";

function NavLinks({ variant, pathname }: { variant: Variant; pathname: string | null }) {
  if (variant === "desktop") {
    return (
      <nav className="hidden items-center gap-1 sm:flex">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => play("tap")}
              className={`relative rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active ? "text-on-pitch" : "text-muted hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-pitch"
                  transition={{ type: "spring", stiffness: 500, damping: 36 }}
                />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <div className="flex">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => play("tap")}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                active ? "text-pitch-strong" : "text-muted"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="tab-dot"
                  className="absolute top-0 h-1 w-8 rounded-b-full bg-pitch"
                />
              )}
              <motion.svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ y: active ? -1 : 0, scale: active ? 1.08 : 1 }}
              >
                {item.icon}
              </motion.svg>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ActiveNavLinks({ variant }: { variant: Variant }) {
  return <NavLinks variant={variant} pathname={usePathname()} />;
}

/**
 * With cacheComponents on, usePathname suspends on routes whose params are only known at
 * request time (such as the Clerk catch-all /sign-in/...). The Suspense boundary keeps the
 * rest of the header prerendered and shows the links unhighlighted until the path resolves.
 */
function Nav({ variant }: { variant: Variant }) {
  return (
    <Suspense fallback={<NavLinks variant={variant} pathname={null} />}>
      <ActiveNavLinks variant={variant} />
    </Suspense>
  );
}

export function Header() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2.5">
          <Link href="/" className="group flex items-center gap-2" aria-label="Footlas home">
            <motion.span
              className="block h-8 w-8"
              whileHover={{ rotate: 144 }}
              whileTap={{ scale: 0.85, rotate: 216 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
            >
              <FootballMark className="h-full w-full" />
            </motion.span>
            <span className="font-display text-2xl leading-none font-black tracking-tight uppercase">
              Footlas
            </span>
          </Link>
          <Nav variant="desktop" />
          <div className="flex items-center gap-2">
            <SoundToggle />
            <ThemeToggle />
            <AccountControls />
          </div>
        </div>
      </header>
      <Nav variant="mobile" />
    </>
  );
}
