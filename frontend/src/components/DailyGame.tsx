"use client";

import Link from "next/link";
import { useState } from "react";

import { useApi, useApiData } from "@/lib/api";
import { SignInPrompt, useAuthState } from "@/lib/auth";
import type { DailyAnswerResult, DailyState, UnlockedAchievement } from "@/lib/types";

import { ErrorNote } from "./PracticeGame";
import { StreakBadge, UnlockedToast, XpBar } from "./ProgressBits";
import { QuestionView } from "./QuestionView";

/** Ten questions a day, one attempt each. Finishing keeps the streak alive. */
export function DailyGame() {
  const { ready, signedIn } = useAuthState();
  const api = useApi();
  const { data, error, mutate } = useApiData<DailyState>("/api/daily");
  const [index, setIndex] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [bonus, setBonus] = useState(0);

  if (ready && !signedIn) return <SignInPrompt message="Sign in to play today's challenge" />;
  if (error) return <ErrorNote message={error.message} />;
  if (!data) return <p className="text-muted">Loading today&apos;s challenge…</p>;

  const firstOpen = data.items.findIndex((item) => !item.result);
  const current = index ?? (firstOpen === -1 ? null : firstOpen);
  const showSummary = current === null;

  const answer = async (questionId: number, given: string) => {
    setPending(true);
    setAnswerError(null);
    try {
      const r = await api.post<DailyAnswerResult>("/api/daily/answer", {
        question_id: questionId,
        answer: given,
      });
      setUnlocked(r.unlocked ?? []);
      if (r.summary.bonus_xp) setBonus(r.summary.bonus_xp);
      await mutate(
        {
          ...data,
          items: data.items.map((item) =>
            item.question.id === questionId ? { ...item, result: { ...r, given } } : item,
          ),
          summary: r.summary,
          progress: r.progress ?? data.progress,
        },
        { revalidate: false },
      );
      setIndex(data.items.findIndex((item) => item.question.id === questionId));
    } catch (e) {
      setAnswerError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  const goNext = () => {
    const next = data.items.findIndex((item) => !item.result);
    setIndex(next === -1 ? null : next);
    setUnlocked([]);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-muted uppercase">
            Daily challenge
          </h1>
          <p className="text-sm text-muted">{formatDay(data.day)}</p>
        </div>
        <StreakBadge streak={data.progress.streak} />
      </div>

      <ol className="flex gap-1.5" aria-label="Progress">
        {data.items.map((item, i) => (
          <li key={item.question.id} className="flex-1">
            <button
              type="button"
              disabled={!item.result}
              onClick={() => setIndex(i)}
              aria-label={`Question ${i + 1}`}
              className={`h-2.5 w-full rounded-full ${
                item.result
                  ? item.result.correct
                    ? "bg-pitch"
                    : "bg-danger"
                  : i === current
                    ? "bg-gold"
                    : "bg-surface-muted"
              } ${i === current ? "ring-2 ring-foreground/30 ring-offset-1" : ""}`}
            />
          </li>
        ))}
      </ol>

      {answerError && <ErrorNote message={answerError} />}

      {showSummary ? (
        <Summary state={data} bonus={bonus} />
      ) : (
        <>
          <p className="text-sm text-muted">
            Question {current + 1} of {data.items.length}
          </p>
          <QuestionView
            key={data.items[current].question.id}
            question={data.items[current].question}
            result={data.items[current].result}
            pending={pending}
            onAnswer={(given) => answer(data.items[current].question.id, given)}
          />
          {data.items[current].result && (
            <button
              type="button"
              onClick={goNext}
              className="self-start rounded-full bg-pitch px-6 py-2.5 font-semibold text-white hover:bg-pitch-strong"
            >
              {data.summary.complete ? "See results" : "Next question →"}
            </button>
          )}
        </>
      )}
      <UnlockedToast achievements={unlocked} />
    </div>
  );
}

function Summary({ state, bonus }: { state: DailyState; bonus: number }) {
  const { summary, progress } = state;
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6">
      <div>
        <p className="text-4xl font-black">
          {summary.correct}/{summary.total}
        </p>
        <p className="mt-1 text-muted">
          {summary.perfect
            ? "A perfect day. Every answer right!"
            : "Challenge complete. Come back tomorrow to keep your streak going."}
        </p>
        {bonus > 0 && (
          <p className="mt-2 font-semibold text-gold">+{bonus} XP completion bonus</p>
        )}
      </div>
      <XpBar progress={progress} />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/play/map"
          className="rounded-full bg-pitch px-5 py-2 font-semibold text-white hover:bg-pitch-strong"
        >
          Keep practising on the map
        </Link>
        <Link
          href="/profile"
          className="rounded-full border border-border px-5 py-2 font-semibold hover:bg-surface-muted"
        >
          View profile
        </Link>
      </div>
      <p className="text-sm text-muted">Tap any bar above to review a question and its Learn Card.</p>
    </div>
  );
}

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
