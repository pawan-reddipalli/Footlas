"use client";

/**
 * Game feel in one place: synthesised sounds, phone haptics and the football's reactions.
 *
 * Sounds are generated with the Web Audio API, so there are no audio files to license or
 * load. Haptics use the Vibration API where the browser has it (Android Chrome) and do
 * nothing elsewhere. The 3D football listens for "footlas:ball" events, so any screen can
 * make it react without knowing where it is mounted.
 */

export type Cue = "tap" | "kick" | "pick" | "correct" | "wrong" | "whistle" | "levelUp" | "unlock";
export type BallReaction = "kick" | "wobble" | "cheer" | "nudge";

const SOUND_KEY = "footlas.sound";
const BALL_EVENT = "footlas:ball";
const SOUND_EVENT = "footlas:sound-change";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* storage blocked: the toggle still works for this page view */
  }
  window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: on }));
}

export function onSoundChange(fn: (on: boolean) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<boolean>).detail);
  window.addEventListener(SOUND_EVENT, handler);
  return () => window.removeEventListener(SOUND_EVENT, handler);
}

type Tone = {
  freq: number;
  to?: number;
  at?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
};

function tones(list: Tone[]) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const t of list) {
    const start = now + (t.at ?? 0);
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.dur);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(t.gain ?? 0.18, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.connect(amp).connect(ac.destination);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

/** A short filtered noise burst: the thump of a boot on a ball. */
function thump(gain = 0.35, at = 0) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + at;
  const length = Math.floor(ac.sampleRate * 0.09);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  const amp = ac.createGain();
  amp.gain.value = gain;
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(start);
}

/** Referee's whistle: a warbling high tone. */
function whistle() {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  const amp = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = 2900;
  lfo.frequency.value = 32;
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain).connect(osc.frequency);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
  amp.gain.setValueAtTime(0.09, now + 0.32);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  osc.connect(amp).connect(ac.destination);
  osc.start(now);
  lfo.start(now);
  osc.stop(now + 0.45);
  lfo.stop(now + 0.45);
}

const SOUNDS: Record<Cue, () => void> = {
  tap: () => tones([{ freq: 520, to: 380, dur: 0.06, type: "triangle", gain: 0.08 }]),
  kick: () => thump(0.4),
  pick: () => {
    thump(0.12);
    tones([{ freq: 660, dur: 0.07, type: "triangle", gain: 0.07 }]);
  },
  correct: () => {
    thump(0.3);
    tones([
      { freq: 660, dur: 0.14, type: "triangle", at: 0.03 },
      { freq: 990, dur: 0.24, type: "triangle", at: 0.11 },
    ]);
  },
  wrong: () =>
    tones([
      { freq: 220, to: 140, dur: 0.22, type: "sawtooth", gain: 0.06 },
      { freq: 160, to: 110, dur: 0.28, type: "sine", gain: 0.16, at: 0.04 },
    ]),
  whistle,
  levelUp: () =>
    tones(
      [523, 659, 784, 1047].map((freq, i) => ({
        freq,
        dur: 0.28,
        type: "triangle" as const,
        at: i * 0.09,
        gain: 0.14,
      })),
    ),
  unlock: () =>
    tones([
      { freq: 1175, dur: 0.18, type: "sine", gain: 0.1 },
      { freq: 1568, dur: 0.32, type: "sine", gain: 0.1, at: 0.08 },
    ]),
};

const HAPTICS: Partial<Record<Cue, number | number[]>> = {
  tap: 8,
  kick: 15,
  pick: 12,
  correct: [18, 40, 28],
  wrong: [40, 60, 40],
  levelUp: [20, 40, 20, 40, 60],
  unlock: [15, 30, 15],
};

const BALL: Partial<Record<Cue, BallReaction>> = {
  kick: "kick",
  pick: "nudge",
  correct: "kick",
  wrong: "wobble",
  levelUp: "cheer",
  unlock: "cheer",
};

export function play(cue: Cue) {
  if (typeof window === "undefined") return;
  if (soundEnabled()) {
    try {
      SOUNDS[cue]();
    } catch {
      /* audio can fail on locked-down browsers; feedback still has visuals */
    }
  }
  const pattern = HAPTICS[cue];
  if (pattern && "vibrate" in navigator) navigator.vibrate(pattern);
  const reaction = BALL[cue];
  if (reaction) window.dispatchEvent(new CustomEvent(BALL_EVENT, { detail: reaction }));
}

export function onBallReaction(fn: (r: BallReaction) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<BallReaction>).detail);
  window.addEventListener(BALL_EVENT, handler);
  return () => window.removeEventListener(BALL_EVENT, handler);
}
