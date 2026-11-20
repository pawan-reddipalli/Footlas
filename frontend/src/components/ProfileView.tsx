"use client";

import { motion } from "motion/react";
import { useState } from "react";

import { useApi, useApiData } from "@/lib/api";
import { SignInPrompt, useAuthState } from "@/lib/auth";
import type { Profile } from "@/lib/types";

import { ErrorNote } from "./PracticeGame";
import { Football } from "./ball/Football";
import { PinBadge, StreakBadge, XpBar, levelName, panelsFilled } from "./ProgressBits";

export function ProfileView() {
  const { ready, signedIn } = useAuthState();
  const { data: profile, error, mutate } = useApiData<Profile>("/api/me");

  if (ready && !signedIn) return <SignInPrompt message="Sign in to see your profile" />;
  if (error) return <ErrorNote message={error.message} />;
  if (!profile) return <p className="text-muted">Opening your album…</p>;

  const { stats, progress } = profile;
  const unlocked = profile.achievements.filter((a) => a.unlocked_at).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid items-center gap-6 md:grid-cols-[1fr_280px]">
        <div className="flex items-center gap-4">
          <motion.div
            className="sticker shrink-0 rounded-xl p-1"
            initial={{ rotate: -6, scale: 0.9 }}
            animate={{ rotate: -3, scale: 1 }}
            whileHover={{ rotate: 2, scale: 1.05 }}
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-lg object-cover" />
            ) : (
              <span className="font-display flex h-20 w-20 items-center justify-center rounded-lg bg-pitch text-4xl font-black text-on-pitch">
                {profile.username.slice(0, 1).toUpperCase()}
              </span>
            )}
          </motion.div>
          <div className="min-w-0">
            <UsernameEditor profile={profile} onSaved={(p) => mutate(p, { revalidate: false })} />
            <p className="text-sm text-muted">
              {levelName(progress.level)} · joined {new Date(profile.joined_at).toLocaleDateString()} ·{" "}
              <span className="capitalize">{profile.plan}</span> plan
            </p>
          </div>
        </div>
        <Football filled={panelsFilled(progress)} interactive className="mx-auto aspect-square w-56 md:w-full" />
      </section>

      <section className="sticker flex flex-col gap-4 rounded-2xl p-5">
        <XpBar progress={progress} />
        <div className="flex flex-wrap items-center gap-3">
          <StreakBadge streak={progress.streak} />
          <span className="text-sm text-muted">
            Best streak <span className="font-score font-black text-foreground">{progress.longest_streak}</span>
          </span>
          <span className="text-sm text-muted">
            <span className="font-score font-black text-foreground">{progress.xp}</span> XP total
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
        <h2 className="font-display mb-4 text-3xl font-black uppercase">
          Pin collection{" "}
          <span className="font-score text-lg font-black text-muted">
            {unlocked}/{profile.achievements.length}
          </span>
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {profile.achievements.map((a, i) => (
            <motion.li
              key={a.slug}
              data-testid="pin"
              data-unlocked={a.unlocked_at ? "true" : "false"}
              className={`flex items-center gap-4 rounded-2xl p-4 ${
                a.unlocked_at ? "sticker" : "border border-dashed border-border"
              }`}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 6) * 0.05 }}
            >
              <PinBadge emoji={a.emoji} unlocked={!!a.unlocked_at} size="lg" />
              <div className="flex-1">
                <p className="font-semibold">{a.name}</p>
                <p className="text-sm text-muted">{a.description}</p>
                {!a.unlocked_at && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-pitch"
                      style={{ width: `${(100 * a.progress) / a.threshold}%` }}
                    />
                  </div>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="sticker rounded-2xl p-4">
      <p className="font-score text-3xl font-black">{value}</p>
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
        <h1 className="font-display truncate text-4xl leading-none font-black uppercase">{profile.username}</h1>
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
      <button type="submit" className="rounded-full bg-pitch px-4 py-1.5 text-sm font-semibold text-on-pitch">
        Save
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-sm text-muted">
        Cancel
      </button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}
