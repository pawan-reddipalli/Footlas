"use client";

import Link from "next/link";
import useSWR from "swr";

import { API_URL, useApiData } from "@/lib/api";
import { AccountControls, useAuthState } from "@/lib/auth";
import type { DailyState, Profile } from "@/lib/types";

import { StreakBadge, XpBar } from "./ProgressBits";

const MODES = [
  {
    href: "/play/map",
    emoji: "🌍",
    title: "World Map",
    text: "Find countries, players' nations, clubs and World Cup winners on the map.",
  },
  {
    href: "/play/players",
    emoji: "🕵️",
    title: "Who Am I?",
    text: "Read the clues about a player's career and name them.",
  },
];

type Catalog = { countries: number; clubs: number; players: number; questions: number };

export function Dashboard() {
  const { ready, signedIn } = useAuthState();
  const { data: profile } = useApiData<Profile>("/api/me");
  const { data: daily } = useApiData<DailyState>("/api/daily");
  const { data: catalog } = useSWR<Catalog>(`${API_URL}/api/catalog`, (url: string) =>
    fetch(url).then((r) => r.json()),
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          {!profile
            ? "Learn football by playing."
            : profile.stats.answered > 0
              ? `Welcome back, ${profile.username}`
              : `Welcome, ${profile.username}`}
        </h1>
        <p className="max-w-2xl text-muted">
          Quick games about countries, clubs, players and football history. Every answer comes
          with a Learn Card, so you always walk away knowing something new.
        </p>
        {catalog && (
          <p className="text-sm text-muted">
            {catalog.countries} countries · {catalog.clubs} clubs · {catalog.players} players ·{" "}
            {catalog.questions} questions
          </p>
        )}
        {ready && !signedIn && (
          <div>
            <AccountControls />
          </div>
        )}
      </section>

      {profile && (
        <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <XpBar progress={profile.progress} />
          <StreakBadge streak={profile.progress.streak} />
        </section>
      )}

      <Link
        href="/play/daily"
        className="group flex flex-col gap-2 rounded-2xl bg-pitch p-6 text-white shadow-sm transition hover:bg-pitch-strong"
      >
        <span className="text-sm font-semibold tracking-wide uppercase opacity-80">
          Daily challenge
        </span>
        <span className="text-2xl font-bold">
          {daily?.summary.complete
            ? `Done for today: ${daily.summary.correct}/${daily.summary.total}`
            : daily && daily.summary.answered > 0
              ? `Keep going: ${daily.summary.answered}/${daily.summary.total} answered`
              : "10 questions. One attempt. Keep your streak alive."}
        </span>
        <span className="text-sm opacity-90 group-hover:underline">
          {daily?.summary.complete ? "Review your answers →" : "Play now →"}
        </span>
      </Link>

      <section className="grid gap-4 sm:grid-cols-2">
        {MODES.map((mode) => (
          <Link
            key={mode.href}
            href={mode.href}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 transition hover:border-pitch"
          >
            <span className="text-3xl" aria-hidden>
              {mode.emoji}
            </span>
            <span className="text-lg font-bold">{mode.title}</span>
            <span className="text-sm text-muted">{mode.text}</span>
          </Link>
        ))}
      </section>

      {profile && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Achievements</h2>
            <Link href="/profile" className="text-sm text-pitch-strong hover:underline">
              See all
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.achievements.map((a) => (
              <span
                key={a.slug}
                title={`${a.name}: ${a.description}`}
                className={`flex h-12 w-12 items-center justify-center rounded-xl border border-border text-2xl ${
                  a.unlocked_at ? "bg-gold/15" : "bg-surface-muted opacity-40 grayscale"
                }`}
              >
                {a.emoji}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
