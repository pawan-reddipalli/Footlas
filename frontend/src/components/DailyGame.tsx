"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useApi, useApiData } from "@/lib/api";
import { SignInPrompt, useAuthState } from "@/lib/auth";
import { confettiBurst } from "@/lib/celebrate";
import { play } from "@/lib/feedback";
import type { DailyAnswerResult, DailyState, UnlockedAchievement } from "@/lib/types";

import { GameHud, Scoreboard } from "./GameHud";
import { ErrorNote, NextButton } from "./PracticeGame";
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
  const [finishedNow, setFinishedNow] = useState(false);

  if (ready && !signedIn) return <SignInPrompt message="Sign in to play today's challenge" />;
  if (error) return <ErrorNote message={error.message} />;
  if (!data) return <p className="text-muted">Walking out of the tunnel…</p>;

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
      if (r.summary.complete) setFinishedNow(true);
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

  const answeredCount = data.summary.answered;
  const minute = Math.round((answeredCount / data.items.length) * 90);
  const halfTime =
    current === 5 && !data.items[5]?.result && data.items.slice(0, 5).every((item) => item.result);
  const firstHalfGoals = data.items.slice(0, 5).filter((item) => item.result?.correct).length;

  return (
    <div className="flex flex-col gap-5">
      <GameHud
        title="Daily challenge"
        progress={data.progress}
        subtitle={formatDay(data.day)}
        right={<Scoreboard label={data.summary.complete ? "full time" : "minute"} value={data.summary.complete ? "FT" : `${minute}'`} />}
      />

      {/* Ten questions are the ninety minutes: each one is nine minutes of the match. */}
      <ol className="grid grid-cols-10 gap-1.5" aria-label="Progress">
        {data.items.map((item, i) => {
          const state = item.result ? (item.result.correct ? "goal" : "miss") : i === current ? "live" : "todo";
          return (
            <li key={item.question.id} className={i === 5 ? "relative" : undefined}>
              {i === 5 && (
                <span className="absolute top-0 -left-[5px] h-full w-0.5 rounded bg-border" aria-hidden />
              )}
              <motion.button
                type="button"
                disabled={!item.result}
                onClick={() => {
                  play("tap");
                  setIndex(i);
                }}
                aria-label={`Question ${i + 1}${item.result ? (item.result.correct ? ", correct" : ", missed") : ""}`}
                whileTap={item.result ? { scale: 0.9 } : undefined}
                animate={{ scale: i === current ? 1.08 : 1 }}
                className={`font-score flex h-9 w-full items-center justify-center rounded-lg text-xs font-black transition-colors sm:text-sm ${
                  state === "goal"
                    ? "bg-pitch text-on-pitch"
                    : state === "miss"
                      ? "bg-danger text-on-danger"
                      : state === "live"
                        ? "bg-pick text-pick-ink"
                        : "bg-surface-muted text-muted"
                } ${i === current ? "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background" : ""}`}
              >
                {(i + 1) * 9}&apos;
              </motion.button>
            </li>
          );
        })}
      </ol>

      {answerError && <ErrorNote message={answerError} />}

      {showSummary ? (
        <Summary state={data} bonus={bonus} celebrate={finishedNow} />
      ) : (
        <>
          {halfTime && (
            <motion.p
              className="border-y border-border py-3 text-sm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span className="font-display text-lg font-black uppercase">Half-time, {firstHalfGoals} from 5.</span>{" "}
              Grab an orange slice. The second half kicks off with question 6.
            </motion.p>
          )}
          <p className="text-sm text-muted">
            Question {current + 1} of {data.items.length}
            {current === data.items.length - 1 && !data.items[current].result && ", stoppage time"}
          </p>
          <QuestionView
            key={data.items[current].question.id}
            question={data.items[current].question}
            result={data.items[current].result}
            pending={pending}
            onAnswer={(given) => answer(data.items[current].question.id, given)}
          />
          {data.items[current].result && (
            <NextButton onClick={goNext}>
              {data.summary.complete ? "Full-time report" : "Next question"}
            </NextButton>
          )}
        </>
      )}
      <UnlockedToast achievements={unlocked} />
    </div>
  );
}

function Summary({ state, bonus, celebrate }: { state: DailyState; bonus: number; celebrate: boolean }) {
  const { summary, progress } = state;
  useEffect(() => {
    if (celebrate && summary.perfect) void confettiBurst("perfect");
  }, [celebrate, summary.perfect]);
  return (
    <motion.div
      className="flex flex-col gap-6 border-t-2 border-foreground pt-6"
      initial={{ opacity: 0, y: 24, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="sr-only">Full-time report</h2>
          <p className="font-score text-7xl leading-none font-black">
            {summary.correct}
            <span className="text-muted">–</span>
            {summary.total - summary.correct}
          </p>
          <p className="mt-2 text-muted">
            {summary.perfect
              ? "A perfect match. Every answer right!"
              : "Match over. Come back tomorrow to add a stripe to your scarf."}
          </p>
          {bonus > 0 && (
            <motion.p
              className="font-display mt-2 text-xl font-black text-gold-ink uppercase"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.4 }}
            >
              +{bonus} XP completion bonus
            </motion.p>
          )}
        </div>
        <StreakBadge streak={progress.streak} />
      </div>
      <XpBar progress={progress} />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/play/map"
          className="font-display rounded-full bg-pitch px-6 py-2.5 text-lg font-black text-on-pitch uppercase hover:bg-pitch-strong"
        >
          Keep practising on the map
        </Link>
        <Link
          href="/profile"
          className="font-display rounded-full border-2 border-border px-6 py-2.5 text-lg font-black uppercase hover:border-foreground/40"
        >
          Open your album
        </Link>
      </div>
      <p className="text-sm text-muted">Tap any minute above to replay a question and its Learn Card.</p>
    </motion.div>
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
