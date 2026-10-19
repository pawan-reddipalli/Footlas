"use client";

import { useState } from "react";

import type { AnswerResult, Question } from "@/lib/types";

import { LearnCard } from "./LearnCard";
import { WorldMap } from "./WorldMap";

type Props = {
  question: Question;
  result: AnswerResult | null;
  pending: boolean;
  onAnswer: (answer: string) => void;
};

/** Renders a question in its mode, then the outcome and Learn Card once answered. */
export function QuestionView(props: Props) {
  return (
    <div className="flex flex-col gap-4">
      {props.question.mode === "map" ? <MapQuestion {...props} /> : <ChoiceQuestion {...props} />}
      {props.result && <LearnCard result={props.result} />}
    </div>
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
        <h2 className="text-2xl font-bold">{question.prompt}</h2>
        <p className="mt-1 text-sm text-muted">
          {answered
            ? `Answer: ${result.answer.flag ?? ""} ${result.answer.country}`
            : "Tap a country, then lock it in. Zoom in for small countries."}
        </p>
      </div>
      <WorldMap
        disabled={answered || pending}
        onSelect={setSelected}
        highlight={{
          selected: answered ? null : selected,
          correct: correctId,
          wrong: answered && given !== correctId ? given : null,
        }}
      />
      {!answered && (
        <button
          type="button"
          disabled={!selected || pending}
          onClick={() => selected && onAnswer(selected)}
          className="self-start rounded-full bg-pitch px-6 py-2.5 font-semibold text-white transition hover:bg-pitch-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Checking…" : "Lock it in"}
        </button>
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
      <h2 className="text-2xl font-bold">{question.prompt}</h2>
      {question.clues && (
        <ol className="space-y-2">
          {question.clues.map((clue, i) => (
            <li key={clue} className="flex gap-3 rounded-xl bg-surface-muted px-4 py-3">
              <span className="font-mono text-sm text-muted">{i + 1}</span>
              <span>{clue}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {question.options?.map((option) => {
          const isAnswer = answered && option.id === result.answer.option_id;
          const isWrongPick = answered && option.id === given && !isAnswer;
          return (
            <button
              key={option.id}
              type="button"
              disabled={answered || pending}
              onClick={() => {
                setChosen(option.id);
                onAnswer(option.id);
              }}
              className={`rounded-xl border px-4 py-3 text-left font-semibold transition ${
                isAnswer
                  ? "border-pitch bg-pitch/15 text-pitch-strong"
                  : isWrongPick
                    ? "border-danger bg-danger/10 text-danger"
                    : "border-border bg-surface hover:border-pitch disabled:hover:border-border"
              } ${option.id === chosen && pending ? "opacity-60" : ""}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
