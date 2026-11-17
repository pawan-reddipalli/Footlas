"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { AccountControls } from "@/lib/auth";

const NAV = [
  { href: "/play/daily", label: "Daily" },
  { href: "/play/map", label: "World Map" },
  { href: "/play/players", label: "Who Am I?" },
  { href: "/profile", label: "Profile" },
];

type Variant = "desktop" | "mobile";

function NavLinks({ variant, pathname }: { variant: Variant; pathname: string | null }) {
  if (variant === "desktop") {
    return (
      <nav className="hidden gap-1 sm:flex">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              pathname === item.href
                ? "bg-pitch/15 text-pitch-strong"
                : "text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="flex justify-around border-t border-border sm:hidden">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex-1 py-2 text-center text-xs font-medium ${
            pathname === item.href ? "text-pitch-strong" : "text-muted"
          }`}
        >
          {item.label}
        </Link>
      ))}
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
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
          <span aria-hidden>⚽</span> Footlas
        </Link>
        <Nav variant="desktop" />
        <AccountControls />
      </div>
      <Nav variant="mobile" />
    </header>
  );
}
