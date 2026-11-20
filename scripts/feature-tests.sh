#!/usr/bin/env bash
# Run the on-demand feature tests: backend API tests and browser end-to-end tests.
#
#   ./scripts/feature-tests.sh            # backend + frontend (both)
#   ./scripts/feature-tests.sh backend    # only backend/feature_tests (pytest)
#   ./scripts/feature-tests.sh frontend   # only frontend/e2e (Playwright)
#   ./scripts/feature-tests.sh --dev      # e2e against `next dev` instead of a production build
#
# These are deliberately NOT part of GitHub CI, ./scripts/ci-local.sh or the pre-push hook.
#
# Postgres: by default the script starts the docker compose `db` service (port 5434) and
# uses a throwaway `footlas_feature` database that it recreates every run. To use a
# Postgres you run yourself, set DATABASE_URL to a scratch database. Its public schema is
# dropped and recreated on every run, for example:
#   DATABASE_URL=postgresql+psycopg://me@localhost:5432/footlas_feature ./scripts/feature-tests.sh
#
# Ports: API_PORT (default 8100) and WEB_PORT (default 3100), so a dev server on 3000/8000
# keeps running. PW_CHROMIUM_PATH points Playwright at an already-installed Chromium.
# The first e2e run on a new machine needs `cd frontend && npx playwright install chromium`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUN_BACKEND=1
RUN_FRONTEND=1
WEB_MODE=prod
API_PORT="${API_PORT:-8100}"
WEB_PORT="${WEB_PORT:-3100}"

usage() { sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; }

for arg in "$@"; do
  case "$arg" in
    backend) RUN_FRONTEND=0 ;;
    frontend) RUN_BACKEND=0 ;;
    both) ;;
    --dev) WEB_MODE=dev ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -t 1 ]; then BOLD=$'\033[1m'; GREEN=$'\033[32m'; RED=$'\033[31m'; RESET=$'\033[0m'
else BOLD=""; GREEN=""; RED=""; RESET=""; fi

CURRENT_STEP=""
PIDS=()
LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/footlas-feature-tests.XXXXXX")"
step() { CURRENT_STEP="$*"; echo; echo "${BOLD}==> $*${RESET}"; }

# Stop a process and everything under it: npx starts next, which starts next-server.
kill_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill -TERM "$1" 2>/dev/null || true
}

stop_servers() {
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill_tree "$pid"
  done
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && wait "$pid" 2>/dev/null || true
  done
  PIDS=()
}

on_exit() {
  local code=$?
  stop_servers
  if [ "$code" -ne 0 ]; then
    echo; echo "${RED}${BOLD}Feature tests failed at: ${CURRENT_STEP:-setup}${RESET}"
    echo "Server logs: $LOG_DIR"
  else
    rm -rf "$LOG_DIR"
  fi
}
trap on_exit EXIT

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "${RED}Missing '$1'. $2${RESET}" >&2; exit 1; }
}

port_free() {
  ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

wait_for() {
  local url=$1 name=$2 log=$3 pid=$4
  for _ in $(seq 1 180); do
    curl -fsS -o /dev/null "$url" 2>/dev/null && return 0
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "${RED}$name exited before it was ready. Last lines of its log:${RESET}" >&2
      tail -30 "$log" >&2
      exit 1
    fi
    sleep 1
  done
  echo "${RED}$name did not answer at $url within 3 minutes.${RESET}" >&2
  tail -30 "$log" >&2
  exit 1
}

# ---------------------------------------------------------------- database + Python
prepare_database() {
  if [ -z "${DATABASE_URL:-}" ]; then
    step "Postgres: start docker compose db and recreate footlas_feature"
    need docker "Install Docker Desktop, or set DATABASE_URL to a Postgres you run yourself."
    docker info >/dev/null 2>&1 || {
      echo "${RED}Docker isn't running. Start Docker Desktop and try again.${RESET}" >&2; exit 1; }
    docker compose up -d --wait db 2>/dev/null || docker compose up -d db
    for _ in $(seq 1 30); do
      docker compose exec -T db pg_isready -U footlas -d footlas >/dev/null 2>&1 && break
      sleep 1
    done
    docker compose exec -T db psql -q -U footlas -d footlas -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS footlas_feature WITH (FORCE)" \
      -c "CREATE DATABASE footlas_feature OWNER footlas"
    export DATABASE_URL="postgresql+psycopg://footlas:footlas@localhost:5434/footlas_feature"
  else
    echo "Using DATABASE_URL from your environment. Everything in its public schema will be wiped."
  fi

  step "Backend: Python environment"
  cd "$ROOT/backend"
  if [ ! -x .venv/bin/python ]; then
    if command -v uv >/dev/null 2>&1; then
      uv venv -q -p 3.13 .venv 2>/dev/null || uv venv -q .venv
    else
      need python3 "Install Python 3.12+ (or uv: https://docs.astral.sh/uv/)."
      python3 -m venv .venv
    fi
  fi
  if ! .venv/bin/python -c "import app, pytest, httpx" >/dev/null 2>&1 \
    || [ pyproject.toml -nt .venv/.feature-tests-installed ]; then
    if command -v uv >/dev/null 2>&1; then
      uv pip install -q --python .venv/bin/python -e ".[dev]"
    else
      .venv/bin/python -m pip install -q -e ".[dev]"
    fi
    touch .venv/.feature-tests-installed
  fi
  export PATH="$ROOT/backend/.venv/bin:$PATH"

  reset_schema
  cd "$ROOT"
}

reset_schema() {
  (cd "$ROOT/backend" && python - <<'PY'
import os
from sqlalchemy import create_engine, text
with create_engine(os.environ["DATABASE_URL"]).begin() as conn:
    conn.execute(text("DROP SCHEMA public CASCADE"))
    conn.execute(text("CREATE SCHEMA public"))
PY
  )
}

# ---------------------------------------------------------------- backend
run_backend() {
  step "Backend: pytest feature_tests"
  cd "$ROOT/backend"
  AUTH_MODE=dev ENVIRONMENT=test pytest feature_tests -q
  cd "$ROOT"
}

# ---------------------------------------------------------------- frontend
run_frontend() {
  need node "Install Node 22."
  need npm "Install Node 22."
  need curl "Install curl."

  step "API: migrate and seed a fresh schema, start on port $API_PORT"
  reset_schema
  cd "$ROOT/backend"
  export AUTH_MODE=dev ENVIRONMENT=test CORS_ORIGINS="http://localhost:$WEB_PORT,http://127.0.0.1:$WEB_PORT"
  alembic upgrade head >"$LOG_DIR/alembic.log" 2>&1 || { cat "$LOG_DIR/alembic.log"; exit 1; }
  python -m app.seed >"$LOG_DIR/seed.log" 2>&1 || { cat "$LOG_DIR/seed.log"; exit 1; }
  uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT" >"$LOG_DIR/api.log" 2>&1 &
  PIDS+=($!)
  wait_for "http://localhost:$API_PORT/health" "The API" "$LOG_DIR/api.log" "${PIDS[-1]}"

  cd "$ROOT/frontend"
  step "Frontend: npm dependencies"
  if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    npm ci
  else
    echo "node_modules matches package-lock.json."
  fi

  # Guest mode: blank Clerk keys override any in .env.local, and the app talks to our API.
  export NEXT_PUBLIC_API_URL="http://localhost:$API_PORT"
  export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="" CLERK_SECRET_KEY=""
  export NEXT_TELEMETRY_DISABLED=1
  if [ "$WEB_MODE" = prod ]; then
    step "Frontend: next build (guest mode, API on port $API_PORT)"
    npx next build >"$LOG_DIR/build.log" 2>&1 || { tail -40 "$LOG_DIR/build.log"; exit 1; }
    step "Frontend: next start on port $WEB_PORT"
    npx next start -p "$WEB_PORT" >"$LOG_DIR/web.log" 2>&1 &
  else
    step "Frontend: next dev on port $WEB_PORT"
    npx next dev -p "$WEB_PORT" >"$LOG_DIR/web.log" 2>&1 &
  fi
  PIDS+=($!)
  wait_for "http://localhost:$WEB_PORT/" "The web app" "$LOG_DIR/web.log" "${PIDS[-1]}"

  step "Frontend: Playwright e2e tests"
  E2E_BASE_URL="http://localhost:$WEB_PORT" npx playwright test --trace off
  cd "$ROOT"
  stop_servers
}

check_ports() {
  for port in "$API_PORT" "$WEB_PORT"; do
    port_free "$port" || {
      echo "${RED}Port $port is in use. Free it or set API_PORT / WEB_PORT.${RESET}" >&2; exit 1; }
  done
}

START=$SECONDS
[ "$RUN_FRONTEND" = 1 ] && check_ports
prepare_database
[ "$RUN_BACKEND" = 1 ] && run_backend
[ "$RUN_FRONTEND" = 1 ] && run_frontend
CURRENT_STEP=""
echo; echo "${GREEN}${BOLD}Feature tests passed in $((SECONDS - START))s.${RESET}"
