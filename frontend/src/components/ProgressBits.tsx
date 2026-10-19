import type { Progress, UnlockedAchievement } from "@/lib/types";

export function XpBar({ progress }: { progress: Progress }) {
  const pct = Math.round((100 * progress.xp_into_level) / progress.xp_for_next);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold">Level {progress.level}</span>
        <span className="text-muted">
          {progress.xp_into_level} / {progress.xp_for_next} XP
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function StreakBadge({ streak }: { streak: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${
        streak > 0 ? "bg-gold/20 text-gold" : "bg-surface-muted text-muted"
      }`}
      title="Daily challenge streak"
    >
      🔥 {streak} day{streak === 1 ? "" : "s"}
    </span>
  );
}

export function UnlockedToast({ achievements }: { achievements: UnlockedAchievement[] }) {
  if (achievements.length === 0) return null;
  return (
    <div className="space-y-2" aria-live="polite">
      {achievements.map((a) => (
        <div
          key={a.slug}
          className="flex items-center gap-3 rounded-2xl border border-gold/50 bg-gold/15 px-4 py-3"
        >
          <span className="text-2xl">{a.emoji}</span>
          <div>
            <p className="font-semibold">Achievement unlocked: {a.name}</p>
            <p className="text-sm text-muted">{a.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
