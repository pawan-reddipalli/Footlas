"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { play } from "@/lib/feedback";
import type { AnswerResult, Question } from "@/lib/types";

import { LearnCard } from "./LearnCard";
import { WorldMap, countryName } from "./WorldMap";

type Props = {
  question: Question;
  result: AnswerResult | null;
  pending: boolean;
  onAnswer: (answer: string) => void;
};

const SHAKE = { x: [0, -12, 10, -7, 5, 0], transition: { duration: 0.45 } };

/**
 * Plays the answer cue only when a result arrives while the question is on screen,
 * so reviewing old answers in the daily challenge stays quiet.
 */
function useAnswerCue(result: AnswerResult | null) {
  const hadResult = useRef(!!result);
  useEffect(() => {
    if (result && !hadResult.current) play(result.correct ? "correct" : "wrong");
    hadResult.current = !!result;
  }, [result]);
}

/** Renders a question in its mode, then the outcome and Learn Card once answered. */
export function QuestionView(props: Props) {
  useAnswerCue(props.result);
  return (
    <div className="flex flex-col gap-5">
      {props.question.mode === "map" ? <MapQuestion {...props} /> : <ChoiceQuestion {...props} />}
      <AnimatePresence>{props.result && <LearnCard result={props.result} />}</AnimatePresence>
    </div>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <motion.h2
      className="font-display text-4xl leading-[0.95] font-black uppercase sm:text-5xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.h2>
  );
}

function MapQuestion({ question, result, pending, onAnswer }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = !!result;
  const given = result?.given ?? selected;
  const correctId = result?.answer.map_id ?? null;

  return (
    <>
      <div>
        <Prompt>{question.prompt}</Prompt>
        <p className="mt-2 text-sm text-muted">
          {answered
            ? `Answer: ${result.answer.flag ?? ""} ${result.answer.country}`
            : selected
              ? `${countryName(selected) ?? "That country"} picked. Lock it in, or tap another.`
              : "Tap a country to roll the ball there. Pinch or use + to zoom for small nations."}
        </p>
      </div>
      <motion.div animate={answered && given !== correctId ? SHAKE : undefined}>
        <WorldMap
          disabled={answered || pending}
          onSelect={(id) => {
            setSelected(id);
            play("pick");
          }}
          highlight={{
            selected: answered ? null : selected,
            correct: correctId,
            wrong: answered && given !== correctId ? given : null,
          }}
        />
      </motion.div>
      {!answered && (
        <motion.button
          type="button"
          disabled={!selected || pending}
          onClick={() => selected && onAnswer(selected)}
          whileHover={selected ? { y: -2 } : undefined}
          whileTap={{ scale: 0.95 }}
          className="font-display self-start rounded-full bg-pitch px-8 py-3 text-xl font-black text-on-pitch uppercase shadow-[0_8px_0_-2px_var(--pitch-strong)] transition-opacity active:shadow-none disabled:cursor-not-allowed disabled:opacity-35"
        >
          {pending ? "Checking…" : "Lock it in"}
        </motion.button>
      )}
    </>
  );
}

function ChoiceQuestion({ question, result, pending, onAnswer }: Props) {
  const [chosen, setChosen] = useState<string | null>(null);
  const answered = !!result;
  const given = result?.given ?? chosen;

  return (
    <>
      <Prompt>{question.prompt}</Prompt>
      {question.clues && (
        <ol className="sticker halftone space-y-0 overflow-hidden rounded-2xl">
          <li className="border-b border-border px-4 py-2 text-xs font-semibold text-muted">
            Scouting report
          </li>
          {question.clues.map((clue, i) => (
            <motion.li
              key={clue}
              className="flex gap-3 border-b border-border/60 px-4 py-3 last:border-0"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.18 }}
            >
              <span className="font-score text-lg leading-6 font-black text-pitch">{i + 1}</span>
              <span>{clue}</span>
            </motion.li>
          ))}
        </ol>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {question.options?.map((option, i) => {
          const isAnswer = answered && option.id === result.answer.option_id;
          const isWrongPick = answered && option.id === given && !isAnswer;
          const faded = answered && !isAnswer && !isWrongPick;
          return (
            <motion.button
              key={option.id}
              type="button"
              disabled={answered || pending}
              onClick={() => {
                setChosen(option.id);
                play("pick");
                onAnswer(option.id);
              }}
              initial={{ opacity: 0, y: 14 }}
              animate={
                isWrongPick
                  ? { opacity: 1, y: 0, ...SHAKE }
                  : isAnswer
                    ? { opacity: 1, y: 0, scale: [1, 1.05, 1] }
                    : { opacity: faded ? 0.45 : 1, y: 0 }
              }
              transition={{ delay: answered ? 0 : 0.2 + i * 0.06 }}
              whileHover={answered ? undefined : { y: -3 }}
              whileTap={answered ? undefined : { scale: 0.96 }}
              className={`relative flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left font-semibold transition-colors ${
                isAnswer
                  ? "border-pitch bg-pitch text-on-pitch"
                  : isWrongPick
                    ? "border-danger bg-danger/10 text-danger"
                    : option.id === chosen && pending
                      ? "border-pick bg-pick/20"
                      : "border-border bg-surface hover:border-foreground/40"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black ${
                  isAnswer ? "border-on-pitch/40" : "border-current/20"
                }`}
                aria-hidden
              >
                {isAnswer ? "✓" : isWrongPick ? "✕" : String.fromCharCode(65 + i)}
              </span>
              {option.label}
            </motion.button>
          );
        })}
      </div>
    </>
  );
}
