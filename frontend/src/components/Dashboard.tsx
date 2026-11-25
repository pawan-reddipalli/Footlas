"use client";

import { motion } from "motion/react";
import Link from "next/link";
import useSWR from "swr";

import { API_URL, useApiData } from "@/lib/api";
import { AccountControls, useAuthState } from "@/lib/auth";
import { play } from "@/lib/feedback";
import type { DailyState, Profile } from "@/lib/types";

import { Football } from "./ball/Football";
import { PinBadge, StreakBadge, XpBar, levelName, panelsFilled } from "./ProgressBits";

type Catalog = { countries: number; clubs: number; players: number; questions: number };

const MODES = [
  {
    href: "/play/map",
    title: "World Map",
    text: "Find countries, players' nations, clubs and World Cup winners on the map.",
    art: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="32" r="22" />
        <path d="M14 24c6 2 9 0 12 3s1 7 5 9 8-1 9 4-3 6-2 9M40 12c-2 4 1 6 5 7s6 4 5 8" />
        <circle cx="44" cy="40" r="4" fill="var(--pick)" stroke="currentColor" />
      </svg>
    ),
  },
  {
    href: "/play/players",
    title: "Who Am I?",
    text: "Read the scouting report, clue by clue, and name the player.",
    art: (
      <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="22" r="10" />
        <path d="M14 54c2-11 8-17 18-17s16 6 18 17" />
        <path d="M27 50l5-8 5 8" stroke="var(--pick)" />
        <text x="32" y="26" textAnchor="middle" fontSize="11" fontWeight="900" fill="currentColor" stroke="none">?</text>
      </svg>
    ),
  },
];

export function Dashboard() {
  const { ready, signedIn } = useAuthState();
  const { data: profile } = useApiData<Profile>("/api/me");
  const { data: daily } = useApiData<DailyState>("/api/daily");
  const { data: catalog } = useSWR<Catalog>(`${API_URL}/api/catalog`, (url: string) =>
    fetch(url).then((r) => r.json()),
  );
  const progress = profile?.progress;
  const filled = panelsFilled(progress);

  return (
    <div className="flex flex-col gap-10">
      <section className="grid items-center gap-6 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4">
          <motion.h1
            className="font-display text-5xl leading-[0.92] font-black uppercase sm:text-7xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {!profile ? (
              <>
                Learn football by playing it
              </>
            ) : profile.stats.answered > 0 ? (
              <>
                Back on the pitch, {profile.username}
              </>
            ) : (
              <>
                Welcome to the squad, {profile.username}
              </>
            )}
          </motion.h1>
          <p className="max-w-md text-lg text-muted">
            Quick games about countries, clubs, players and the history of the game. Every answer
            comes with a Learn Card, so you always walk off knowing something new.
          </p>
          {catalog && (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {[
                [catalog.countries, "countries"],
                [catalog.clubs, "clubs"],
                [catalog.players, "players"],
                [catalog.questions, "questions"],
              ].map(([n, label]) => (
                <span key={label}>
                  <span className="font-score text-base font-black text-foreground">{n}</span>{" "}
                  {label}
                </span>
              ))}
            </p>
          )}
          {ready && !signedIn && (
            <div>
              <AccountControls showSignUp />
            </div>
          )}
        </div>

        <div className="relative mx-auto w-full max-w-[260px] sm:max-w-[420px]">
          <Football filled={filled} interactive className="aspect-square w-full cursor-grab active:cursor-grabbing" />
          <p className="-mt-2 text-center text-xs text-muted">
            {progress ? (
              <>
                <span className="font-semibold text-foreground">{filled} of 20 panels</span>{" "}
                stitched toward level {progress.level + 1}. Drag to spin, tap to kick.
              </>
            ) : (
              "Drag to spin, tap to kick."
            )}
          </p>
        </div>
      </section>

      {progress && (
        <section className="grid gap-5 border-y border-border py-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <XpBar progress={progress} />
          <StreakBadge streak={progress.streak} />
        </section>
      )}

      <DailyTicket daily={daily} />

      <section className="grid gap-x-8 sm:grid-cols-2">
        {MODES.map((mode) => (
          <motion.div key={mode.href} whileTap={{ scale: 0.98 }}>
            <Link
              href={mode.href}
              onClick={() => play("tap")}
              className="group flex h-full items-start gap-4 border-t-2 border-foreground py-5 transition-colors hover:border-pitch"
            >
              <span className="text-pitch">{mode.art}</span>
              <span className="flex flex-col gap-1">
                <span className="font-display text-3xl leading-none font-black uppercase group-hover:text-pitch-strong">
                  {mode.title}
                </span>
                <span className="text-sm text-muted">{mode.text}</span>
              </span>
            </Link>
          </motion.div>
        ))}
      </section>

      {profile && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-black uppercase">Pin collection</h2>
            <Link href="/profile" className="text-sm font-semibold text-pitch-strong hover:underline">
              Open your album
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {profile.achievements.map((a) => (
              <span key={a.slug} title={`${a.name}: ${a.description}`}>
                <PinBadge emoji={a.emoji} unlocked={!!a.unlocked_at} />
              </span>
            ))}
          </div>
          {progress && (
            <p className="mt-3 text-sm text-muted">
              You&apos;re in {levelName(progress.level)}. Every level climbs a step up the pyramid.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/** Today's challenge is a matchday ticket you tear off to play. */
function DailyTicket({ daily }: { daily: DailyState | undefined }) {
  const done = daily?.summary.complete;
  const started = daily && daily.summary.answered > 0;
  const minute = daily ? Math.round((daily.summary.answered / daily.summary.total) * 90) : 0;
  return (
    <motion.div whileHover={{ y: -4, rotate: -0.5 }} whileTap={{ scale: 0.98 }}>
      <Link
        href="/play/daily"
        onClick={() => play("whistle")}
        className="perforated relative flex overflow-hidden rounded-2xl bg-pitch text-on-pitch shadow-[0_18px_40px_-20px_rgb(var(--shadow)/0.7)]"
      >
        <div className="flex flex-1 flex-col gap-2 p-6 pt-7">
          <span className="font-display text-4xl leading-none font-black uppercase sm:text-5xl">
            {done
              ? `Full time: ${daily.summary.correct}–${daily.summary.total - daily.summary.correct}`
              : started
                ? `${minute}' and counting`
                : "Kick-off: 10 questions"}
          </span>
          <span className="text-sm opacity-90">
            {daily ? `Daily challenge for ${formatDay(daily.day)}. ` : "Today's daily challenge. "}
            {done
              ? "Review the match and every Learn Card."
              : "One attempt each. Finish to keep your scarf growing."}
          </span>
        </div>
        <div className="flex w-28 flex-col items-center justify-center gap-1 border-l-2 border-dashed border-on-pitch/30 p-4 sm:w-36">
          <span className="font-score text-4xl font-black">{done ? "FT" : `${minute}'`}</span>
          <span className="text-xs font-semibold uppercase opacity-80">{done ? "Review" : started ? "Resume" : "Tear to play"}</span>
        </div>
      </Link>
    </motion.div>
  );
}

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
