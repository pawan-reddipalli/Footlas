"use client";

import { useState } from "react";

import { useApi, useApiData } from "@/lib/api";
import { SignInPrompt, useAuthState } from "@/lib/auth";
import type { AnswerResult, Mode, Question, UnlockedAchievement } from "@/lib/types";

import { UnlockedToast, XpBar } from "./ProgressBits";
import { QuestionView } from "./QuestionView";

/** Endless practice in one mode: question, answer, Learn Card, next. */
export function PracticeGame({ mode, title }: { mode: Mode; title: string }) {
  const { ready, signedIn } = useAuthState();
  const api = useApi();
  // Bumping `round` asks the API for a fresh random question.
  const [round, setRound] = useState(0);
  const { data: question, error: loadError, isValidating } = useApiData<Question>(
    `/api/practice/next?mode=${mode}&round=${round}`,
    { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false },
  );
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState({ answered: 0, correct: 0, xp: 0 });
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);

  const next = () => {
    setResult(null);
    setUnlocked([]);
    setError(null);
    setRound((r) => r + 1);
  };

  const answer = async (given: string) => {
    if (!question) return;
    setPending(true);
    try {
      const r = await api.post<AnswerResult>("/api/practice/answer", {
        question_id: question.id,
        answer: given,
      });
      setResult({ ...r, given });
      setUnlocked(r.unlocked ?? []);
      setScore((s) => ({
        answered: s.answered + 1,
        correct: s.correct + Number(r.correct),
        xp: s.xp + r.xp_awarded,
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  if (ready && !signedIn) return <SignInPrompt message={`Sign in to play ${title}`} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h1>
        <p className="text-sm text-muted">
          This session: {score.correct}/{score.answered} correct · +{score.xp} XP
        </p>
      </div>
      {(error || loadError) && <ErrorNote message={error ?? loadError.message} />}
      {!question && !loadError && <p className="text-muted">Loading question…</p>}
      {question && (
        <QuestionView
          key={question.id}
          question={question}
          result={result}
          pending={pending}
          onAnswer={answer}
        />
      )}
      <UnlockedToast achievements={unlocked} />
      {result && (
        <>
          {result.progress && <XpBar progress={result.progress} />}
          <button
            type="button"
            onClick={next}
            disabled={pending || isValidating}
            className="self-start rounded-full bg-pitch px-6 py-2.5 font-semibold text-white hover:bg-pitch-strong disabled:opacity-40"
          >
            Next question →
          </button>
        </>
      )}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}
