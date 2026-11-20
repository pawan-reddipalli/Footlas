"use client";

import { motion } from "motion/react";

import type { AnswerResult } from "@/lib/types";

const CORRECT_LINES = ["Back of the net!", "Top bins!", "Clinical finish!", "Right in the corner!"];
const WRONG_LINES = ["Off the post", "Just wide", "Saved, but here's the story", "Not this time"];

function pick(lines: string[], seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return lines[Math.abs(h) % lines.length];
}

/**
 * Shown after every answer: the product rule is that every interaction teaches a fact.
 * It deals in like a trading card, flipping over from its edge.
 */
export function LearnCard({ result }: { result: AnswerResult }) {
  const { correct, learn, xp_awarded } = result;
  const verdict = pick(correct ? CORRECT_LINES : WRONG_LINES, learn.title);
  return (
    <div style={{ perspective: 1200 }}>
      <motion.article
        className="sticker relative overflow-hidden rounded-2xl"
        initial={{ rotateY: -95, opacity: 0, y: 20 }}
        animate={{ rotateY: 0, opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ type: "spring", stiffness: 160, damping: 18, delay: 0.25 }}
        style={{ transformOrigin: "left center" }}
      >
        <header
          className={`flex items-center justify-between gap-3 px-5 py-3 ${
            correct ? "bg-pitch text-on-pitch" : "bg-danger text-on-danger"
          }`}
        >
          <p className="font-display text-2xl leading-none font-black uppercase">{verdict}</p>
          {xp_awarded > 0 && (
            <motion.span
              className="font-score rounded-full bg-black/20 px-3 py-1 text-lg font-black"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: [0, 1.3, 1], rotate: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              +{xp_awarded} XP
            </motion.span>
          )}
        </header>
        <div className="halftone p-5">
          <p className="text-xs font-semibold text-muted">Learn Card</p>
          <h3 className="font-display mt-1 text-3xl leading-none font-black uppercase">{learn.title}</h3>
          <p className="mt-3 max-w-prose leading-relaxed">{learn.body}</p>
          {learn.facts.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {learn.facts.map((fact, i) => (
                <motion.li
                  key={fact}
                  className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                >
                  {fact}
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </motion.article>
    </div>
  );
}
