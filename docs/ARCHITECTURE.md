# Footlas architecture

## Stack

| Layer    | Choice                                        | Why                                                         |
| -------- | --------------------------------------------- | ----------------------------------------------------------- |
| Web app  | Next.js 16, React 19, Tailwind 4              | Fast, mobile-friendly UI; easy to deploy on Vercel           |
| API      | FastAPI, SQLAlchemy 2, Alembic, Pydantic      | Typed Python API with auto docs at `/docs`; good fit for AI work in Phase 3 |
| Database | PostgreSQL 16                                 | Relational data suits the football knowledge graph           |
| Auth     | Clerk (web) + JWT verification in the API     | Email, Google and more out of the box                        |
| Map      | `world-atlas` TopoJSON + `d3-geo`, drawn as SVG | No map tiles or API keys; every country is a clickable path |

This is the stack from the Notion plan, unchanged. The additions below are about how the
pieces fit together.

## Backend domains

The backend is split by domain, as suggested on the Notion schema page. Each domain has
its own `models.py`, `service.py` (the rules) and `router.py` (HTTP).

```
backend/app/
  core/            config, database, auth, entitlements
  domains/
    football/      Country, Club, Player, CareerHistory, WorldCup   (the knowledge graph)
    gameplay/      QuizQuestion, DailyChallenge, QuizAnswer + question generator
    users/         User, UserProgress, UserStatistic, Achievement, UserAchievement
  seed/            JSON content + loader (python -m app.seed)
```

Phase 2 content (stadiums, competitions, managers) goes in `football/`; Phase 3 can add
an `ai/` domain and Phase 4 a `social/` domain without touching the others.

## Tables (MVP)

The Notion MVP table list maps onto these tables. [SCHEMA.md](SCHEMA.md) has the diagram,
the rules the database enforces, and how to change the schema.

| Notion name     | Table                          | Notes                                                       |
| --------------- | ------------------------------ | ----------------------------------------------------------- |
| Users           | `users`                        | `auth_id` is the Clerk user id; `plan` is for monetization  |
| UserProgress    | `user_progress`                | XP, current and longest streak, last daily date             |
| UserStatistics  | `user_statistics`              | Answered/correct counters per key (`all`, `mode:map`, `country:BRA`) |
| Countries       | `countries`                    | Football nations; `map_id` links to the map shape           |
| Players         | `players`                      |                                                             |
| Clubs           | `clubs`                        |                                                             |
| CareerHistory   | `career_history`               | Notable spells, oldest first                                |
| QuizQuestions   | `quiz_questions`               | Generated from the football tables, with a Learn Card each  |
| Achievements    | `achievements`, `user_achievements` | Each achievement is "metric ≥ threshold"               |
| DailyChallenges | `daily_challenges`, `quiz_answers` | Same 10 questions for everyone each UTC day             |
| (new)           | `world_cups`                   | Powers "Which country won the YYYY World Cup?"              |

## How a question works

1. The seed script loads the JSON content and runs `gameplay/generator.py`, which turns
   facts into questions: find a country, where is this player from, which country is
   this club from, who won this World Cup, and "Who am I?" from a player's career.
   Adding one player to `players.json` adds two questions with Learn Cards.
2. The API sends the question **without the answer**.
3. The user answers. The API checks it, awards XP, updates statistics, streak and
   achievements, and only then returns the correct answer and the Learn Card.

Because scoring happens only on the server, XP and streaks can be trusted, which matters
once leaderboards (Phase 4) exist.

England, Scotland, Wales and Northern Ireland share the United Kingdom's shape on the
map, so a click on the UK is right for all four; the Learn Card explains why.

## Game rules

| Rule                     | Value                                                         |
| ------------------------ | ------------------------------------------------------------- |
| Practice correct answer  | +5 XP, once per question per day (no farming by repeating)    |
| Daily correct answer     | +10 XP                                                        |
| Daily completion bonus   | +20 XP, plus +50 XP for a perfect 10/10                       |
| Levels                   | Level n needs 100 × n more XP than the last (100, 200, 300…) |
| Streak                   | +1 for each consecutive UTC day the daily challenge is finished |
| Daily challenge          | 6 map + 4 "Who Am I?" questions, one attempt each              |

Days are UTC for now. Per-user time zones are a likely follow-up.

## Auth

- **Production:** the web app signs users in with Clerk and sends the session token as
  `Authorization: Bearer`. The API verifies it against Clerk's JWKS (issuer, expiry and
  allowed origins) and creates the user on first sight.
- **Local:** without Clerk keys, the web app runs in guest mode and sends `X-Dev-User`.
  The API accepts that only with `AUTH_MODE=dev`, and refuses to start in production in
  dev mode.

## Monetization, later

The Notion plan says learning stays free and money comes from optional support,
cosmetics and AI extras, never gameplay advantages. The code is ready for that without
building any of it yet:

- `users.plan` is `free`, `supporter` or `pro`.
- `app/core/entitlements.py` is the only place that says what a plan unlocks
  (`supporter_badge`, `cosmetic_themes`, `ai_coach`). Nothing in gameplay checks it.
- When payments arrive, a Stripe Checkout + webhook endpoint sets `users.plan`, and a
  `payments` table records events. "Buy Me a Coffee" (Phase 6) needs no code at all.

## Hosting (suggested)

| Part     | Option                    | Notes                                         |
| -------- | ------------------------- | --------------------------------------------- |
| Web app  | Vercel                    | Set `NEXT_PUBLIC_API_URL` and the Clerk keys  |
| API      | Railway, Render or Fly.io | `backend/Dockerfile` runs migrations on start |
| Database | Neon or Supabase Postgres | Free tiers are enough for the MVP             |

Set `CORS_ORIGINS` on the API to the web app's URL.
