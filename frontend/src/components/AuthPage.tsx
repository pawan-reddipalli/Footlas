"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";

import { useAuthState } from "@/lib/auth";
import { SIGN_IN_URL, SIGN_UP_URL } from "@/lib/clerk-routes";

const COPY = {
  "sign-in": {
    title: "Welcome back",
    blurb: "Sign in to keep your streak going and pick up where you left off.",
  },
  "sign-up": {
    title: "Join Footlas",
    blurb: "Create a free account to save your XP, streaks and achievements.",
  },
} as const;

export function AuthPage({ kind }: { kind: "sign-in" | "sign-up" }) {
  const { mode } = useAuthState();
  const copy = COPY[kind];

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-5xl leading-none font-black uppercase">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted">{copy.blurb}</p>
      </div>
      {mode === "guest" ? (
        <div className="sticker max-w-md rounded-2xl p-6 text-sm text-muted">
          <p>
            Accounts aren&apos;t switched on in this copy of Footlas, so you&apos;re playing in
            guest mode and your progress is saved for this browser.
          </p>
          <Link href="/" className="mt-4 inline-block font-semibold text-pitch-strong underline">
            Start playing
          </Link>
        </div>
      ) : (
        // Clerk's path routing reads the URL, which is only known at request time on this
        // catch-all route, so it streams in behind a Suspense boundary.
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          {kind === "sign-in" ? (
            <SignIn path={SIGN_IN_URL} routing="path" signUpUrl={SIGN_UP_URL} />
          ) : (
            <SignUp path={SIGN_UP_URL} routing="path" signInUrl={SIGN_IN_URL} />
          )}
        </Suspense>
      )}
    </div>
  );
}
