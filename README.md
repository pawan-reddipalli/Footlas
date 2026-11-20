# Footlas

The Duolingo of football. Learn about countries, clubs, players and football history
through quick games, with a Learn Card after every answer.

**Phase 1 (MVP) is in this repo:** a clickable world map, a "Who Am I?" player game, a
10-question daily challenge, XP and levels, daily streaks, achievements and profiles.

| Folder      | What it is                                                     |
| ----------- | -------------------------------------------------------------- |
| `frontend/` | Next.js 16 app (TypeScript, Tailwind, Clerk)                   |
| `backend/`  | FastAPI API, SQLAlchemy models, Alembic migrations, seed data  |
| `docs/`     | [Architecture](docs/ARCHITECTURE.md) and [content guide](docs/CONTENT.md) |

## Run it locally

You need Python 3.12+ (easiest with [uv](https://docs.astral.sh/uv/)), Node 20+ and Docker.

```bash
# 1. Database
docker compose up -d                      # Postgres on localhost:5434

# 2. API (http://localhost:8000, docs at /docs)
cd backend
uv venv -p 3.12 && source .venv/bin/activate
uv pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
python -m app.seed                        # load countries, clubs, players, questions
uvicorn app.main:app --reload

# 3. Web app (http://localhost:3000)
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

The database uses port 5434 so it doesn't clash with a Postgres already running on
5432. Change `docker-compose.yml` and `DATABASE_URL` together if you need another port.

Without Clerk keys the app runs in **guest mode**: each browser gets a guest id and the
API (with `AUTH_MODE=dev`) trusts it. To use real accounts, create a Clerk app, put its
keys in `frontend/.env.local`, and set `AUTH_MODE=clerk` and `CLERK_ISSUER` in
`backend/.env`. The steps are in [Architecture > Turning on Clerk](docs/ARCHITECTURE.md#turning-on-clerk).

## Tests

Run everything GitHub CI runs (backend lint, migrations and tests, then frontend lint,
type-check and build) with one command. It needs Docker running for Postgres:

```bash
./scripts/ci-local.sh                 # both jobs; or add `backend` / `frontend`
./scripts/ci-local.sh --install-hook  # also run it before every git push
```

The script recreates a throwaway `footlas_ci` database each run, so your dev data is safe.
Skip the hook once with `git push --no-verify`. The steps mirror
`.github/workflows/ci.yml`, so change both together.

To run pieces by hand:

```bash
cd backend && pytest          # needs the footlas_test database (docker compose creates it)
cd frontend && npm run lint && npm run build
```

### Feature tests (on demand)

A second, larger suite checks that every MVP feature still works end to end. Run it
before merging a big change:

```bash
./scripts/feature-tests.sh            # both; or `backend` / `frontend`
./scripts/feature-tests.sh --dev      # e2e against `next dev` instead of a production build
```

| Part | Where | What it checks |
| ---- | ----- | -------------- |
| API (pytest, ~70 cases, ~15s) | `backend/feature_tests/` | Map game (question shape, right/wrong, UK home nations), Who Am I?, daily challenge (6 map + 4 player, one attempt each, bonuses, same set for everyone), XP and level boundaries, streaks over several days, every achievement in `achievements.json`, profiles and renaming, Learn Cards on every question |
| Browser (Playwright, 7 tests) | `frontend/e2e/` | In guest mode: home dashboard (ball, XP, streak), map game, Who Am I?, daily challenge clock, profile stats and pins, theme toggle |

The script recreates a throwaway `footlas_feature` database (or wipes the public schema of
your `DATABASE_URL`), starts the API on port 8100 and the web app on 3100 (change them with
`API_PORT` / `WEB_PORT`), runs the tests and stops both servers. The first browser run on a
new machine needs `cd frontend && npx playwright install chromium`.

These tests are **deliberately not in CI**, `ci-local.sh` or the pre-push hook. Plain
`pytest` only collects `backend/tests/`. To turn them on later, add one step to the end of
`run_backend` in `scripts/ci-local.sh` (and the same step to `.github/workflows/ci.yml`):

```bash
pytest feature_tests -q
```

The browser tests need running servers, so they are best kept as a manual
`./scripts/feature-tests.sh frontend` before releases.
