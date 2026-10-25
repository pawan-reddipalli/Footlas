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
keys in `frontend/.env.local`, and set `AUTH_MODE=clerk`, `CLERK_ISSUER` and
`CLERK_JWKS_URL` in `backend/.env`.

## Tests

```bash
cd backend && pytest          # needs the footlas_test database (docker compose creates it)
cd frontend && npm run lint && npm run build
```
