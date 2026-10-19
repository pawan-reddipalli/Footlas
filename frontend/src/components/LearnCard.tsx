import type { AnswerResult } from "@/lib/types";

/** Shown after every answer: the product rule is that every interaction teaches a fact. */
export function LearnCard({ result }: { result: AnswerResult }) {
  const { correct, learn, xp_awarded } = result;
  return (
    <div
      className={`rounded-2xl border p-5 ${
        correct ? "border-pitch/40 bg-pitch/10" : "border-danger/40 bg-danger/10"
      }`}
      aria-live="polite"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className={`text-lg font-bold ${correct ? "text-pitch-strong" : "text-danger"}`}>
          {correct ? "Correct!" : "Not quite"}
        </p>
        {xp_awarded > 0 && (
          <span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-semibold text-gold">
            +{xp_awarded} XP
          </span>
        )}
      </div>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">Learn</p>
      <h3 className="mt-1 text-lg font-semibold">{learn.title}</h3>
      <p className="mt-2 leading-relaxed">{learn.body}</p>
      {learn.facts.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {learn.facts.map((fact) => (
            <li key={fact} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
