# Footlas design system

Footlas is built around one object: **the football**. Read this before changing any UI, and keep
new screens inside it.

## Two moods

| | Light: Matchday | Dark: Floodlit |
| --- | --- | --- |
| Feel | A 90s matchday programme and sticker album | A night match under floodlights, chalk on a tactics board |
| Base | Chalk white `--background` (a neutral off-white, never cream) | Night pitch with mown stripes |
| Accent | Pitch green `--pitch`, programme red `--danger` | Bright pitch green, highlighter yellow `--pick` |
| Rewards | Gold `--gold` (text uses `--gold-ink`) | Gold |

All colours are tokens in `src/app/globals.css`. Never hard-code a colour in a component.
next-themes sets `data-theme` on `<html>`; Tailwind's `dark:` variant follows it.

## Type

- **Big Shoulders** (`font-display`, uppercase, black weight): headings, prompts, buttons. Stadium signage.
- **Schibsted Grotesk** (`font-sans`): reading text.
- **Doto** (`font-score`): numbers that tick, like scoreboards, minutes, XP and stats.

No eyebrow labels above headings, no gradient text, no emoji as UI icons (achievement emoji from
the API sit inside pin badges). Headlines are one colour: don't pick out a word in green or italics.

## Surfaces

- `.sticker`: thick border with a lifted shadow. Only for things you hold: Learn Cards, the map,
  dialogs and auth panels. Group everything else with whitespace and a hairline rule
  (`border-y border-border`), not another card.
- No textures (halftone, dithering, grain) on surfaces.
- `.perforated`: ticket-stub edge, for the daily challenge ticket.

## The football

- `components/ball/Football.tsx` is the 3D ball (React Three Fiber, custom shader). Its 20 hexagon
  panels fill with gold as the player earns XP toward the next level (`panelsFilled()`).
- It reacts to the game through `play(cue)` in `src/lib/feedback.ts`: `correct` kicks it, `wrong`
  wobbles it, `levelUp` and `unlock` make it cheer, `pick` nudges it. Interactive balls spin when
  dragged and kick when tapped.
- `FootballMark` is the flat SVG version for the logo, loading states and the no-WebGL fallback.

## Motion and feedback

- Motion (`motion/react`) with springs. The default spring is set in `Providers.tsx`.
- Big effects only on meaningful moments: answers, level-ups, unlocks, a perfect daily. Navigation
  stays quick and calm.
- Every input gets feedback within 100 ms: a press scale plus a `play()` cue.
- Sounds are synthesised with Web Audio (no files). The whistle toggle mutes sound and haptics.
- `MotionConfig reducedMotion="user"` respects reduced motion. The ball stops idling and confetti is
  skipped.

## Copy

Talk like a mate at the pub, not a SaaS landing page: "Back of the net!", "Off the post",
"Full-time report". Every screen still teaches a fact.

Avoid the generic AI-site tells: no `·` separators between words (use commas or a new line),
no arrows on every button, no sparkle icons, no fading sections in on scroll, no made-up stats.
