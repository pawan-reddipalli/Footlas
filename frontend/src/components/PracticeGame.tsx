"use client";

import { motion } from "motion/react";
import { useState } from "react";

import { useApi, useApiData } from "@/lib/api";
import { SignInPrompt, useAuthState } from "@/lib/auth";
import type { AnswerResult, Mode, Profile, Progress, Question, UnlockedAchievement } from "@/lib/types";

import { GameHud, Scoreboard } from "./GameHud";
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
  const { data: profile } = useApiData<Profile>("/api/me");
  const [latest, setLatest] = useState<Progress | null>(null);
  const progress = latest ?? profile?.progress;

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
      if (r.progress) setLatest(r.progress);
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
      <GameHud
        title={title}
        progress={progress}
        subtitle={<>Practice round, +{score.xp} XP this session</>}
        right={<Scoreboard label="correct" value={`${score.correct}/${score.answered}`} />}
      />
      {(error || loadError) && <ErrorNote message={error ?? loadError.message} />}
      {!question && !loadError && <p className="text-muted">Setting up the next question…</p>}
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
          <NextButton onClick={next} disabled={pending || isValidating}>
            Next question
          </NextButton>
        </>
      )}
    </div>
  );
}

export function NextButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.95 }}
      className="font-display group flex items-center gap-2 self-start rounded-full bg-foreground px-7 py-3 text-xl font-black text-background uppercase disabled:opacity-40"
    >
      {children}
      <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </motion.button>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}
