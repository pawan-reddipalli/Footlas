"use client";

import { useState } from "react";

import { useApi, useApiData } from "@/lib/api";
import { SignInPrompt, useAuthState } from "@/lib/auth";
import type { Profile } from "@/lib/types";

import { ErrorNote } from "./PracticeGame";
import { StreakBadge, XpBar } from "./ProgressBits";

export function ProfileView() {
  const { ready, signedIn } = useAuthState();
  const { data: profile, error, mutate } = useApiData<Profile>("/api/me");

  if (ready && !signedIn) return <SignInPrompt message="Sign in to see your profile" />;
  if (error) return <ErrorNote message={error.message} />;
  if (!profile) return <p className="text-muted">Loading profile…</p>;

  const { stats, progress } = profile;
  const unlocked = profile.achievements.filter((a) => a.unlocked_at).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-4">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-pitch text-2xl font-black text-white">
            {profile.username.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <UsernameEditor profile={profile} onSaved={(p) => mutate(p, { revalidate: false })} />
          <p className="text-sm text-muted">
            Joined {new Date(profile.joined_at).toLocaleDateString()} ·{" "}
            <span className="capitalize">{profile.plan}</span> plan
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <XpBar progress={progress} />
        <div className="flex flex-wrap gap-2">
          <StreakBadge streak={progress.streak} />
          <span className="rounded-full bg-surface-muted px-3 py-1 text-sm text-muted">
            Best streak: {progress.longest_streak}
          </span>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-sm text-muted">
            {progress.xp} XP total
          </span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Questions" value={stats.answered} />
        <Stat label="Accuracy" value={stats.accuracy === null ? "–" : `${stats.accuracy}%`} />
        <Stat label="Map correct" value={stats.by_mode.map?.correct ?? 0} />
        <Stat label="Players named" value={stats.by_mode.player?.correct ?? 0} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">
          Achievements{" "}
          <span className="text-sm font-normal text-muted">
            {unlocked}/{profile.achievements.length}
          </span>
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {profile.achievements.map((a) => (
            <li
              key={a.slug}
              className={`flex gap-3 rounded-2xl border p-4 ${
                a.unlocked_at ? "border-gold/50 bg-gold/10" : "border-border bg-surface"
              }`}
            >
              <span className={`text-3xl ${a.unlocked_at ? "" : "opacity-40 grayscale"}`}>
                {a.emoji}
              </span>
              <div className="flex-1">
                <p className="font-semibold">{a.name}</p>
                <p className="text-sm text-muted">{a.description}</p>
                {!a.unlocked_at && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full bg-pitch"
                      style={{ width: `${(100 * a.progress) / a.threshold}%` }}
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-2xl font-black">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function UsernameEditor({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const api = useApi();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(profile.username);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="truncate text-2xl font-black">{profile.username}</h1>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm text-pitch-strong hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSaved(await api.patch<Profile>("/api/me", { username: value }));
      setEditing(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Username"
        className="rounded-lg border border-border bg-surface px-3 py-1.5"
        maxLength={32}
      />
      <button type="submit" className="rounded-full bg-pitch px-4 py-1.5 text-sm font-semibold text-white">
        Save
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-sm text-muted">
        Cancel
      </button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}
