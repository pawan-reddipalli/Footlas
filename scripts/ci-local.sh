#!/usr/bin/env bash
# Run the same checks as .github/workflows/ci.yml on your own machine.
#
#   ./scripts/ci-local.sh              # backend + frontend
#   ./scripts/ci-local.sh backend      # only the backend job
#   ./scripts/ci-local.sh frontend     # only the frontend job
#   ./scripts/ci-local.sh --clean      # reinstall dependencies from scratch, like CI does
#   ./scripts/ci-local.sh --install-hook   # run these checks before every `git push`
#
# Postgres: by default the script starts the docker compose `db` service (port 5434) and
# runs migrations and tests against a throwaway `footlas_ci` database that it recreates on
# every run, so your dev data and the footlas_test database are never touched. To use a
# Postgres you run yourself instead, set DATABASE_URL to a scratch database. Its public
# schema is dropped and recreated on every run, for example:
#   DATABASE_URL=postgresql+psycopg://me@localhost:5432/footlas_ci ./scripts/ci-local.sh
#
# Keep the steps below in sync with .github/workflows/ci.yml.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUN_BACKEND=1
RUN_FRONTEND=1
CLEAN=0

usage() { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; }

for arg in "$@"; do
  case "$arg" in
    backend) RUN_FRONTEND=0 ;;
    frontend) RUN_BACKEND=0 ;;
    --clean) CLEAN=1 ;;
    --install-hook)
      git config core.hooksPath .githooks
      echo "Installed: './scripts/ci-local.sh' now runs before every git push."
      echo "Skip it once with 'git push --no-verify'. Remove it with 'git config --unset core.hooksPath'."
      exit 0
      ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -t 1 ]; then BOLD=$'\033[1m'; GREEN=$'\033[32m'; RED=$'\033[31m'; RESET=$'\033[0m'
else BOLD=""; GREEN=""; RED=""; RESET=""; fi

CURRENT_STEP=""
step() { CURRENT_STEP="$*"; echo; echo "${BOLD}==> $*${RESET}"; }
on_exit() {
  local code=$?
  if [ "$code" -ne 0 ]; then
    echo; echo "${RED}${BOLD}Local CI failed at: ${CURRENT_STEP:-setup}${RESET}"
  fi
}
trap on_exit EXIT

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "${RED}Missing '$1'. $2${RESET}" >&2; exit 1; }
}

# ---------------------------------------------------------------- backend
run_backend() {
  local db_url="${DATABASE_URL:-}"
  CUSTOM_DB=""

  if [ -z "$db_url" ]; then
    step "Postgres: start docker compose db and recreate footlas_ci"
    need docker "Install Docker Desktop, or set DATABASE_URL to a Postgres you run yourself."
    docker info >/dev/null 2>&1 || {
      echo "${RED}Docker isn't running. Start Docker Desktop and try again.${RESET}" >&2; exit 1; }
    docker compose up -d --wait db 2>/dev/null || docker compose up -d db
    for _ in $(seq 1 30); do
      docker compose exec -T db pg_isready -U footlas -d footlas >/dev/null 2>&1 && break
      sleep 1
    done
    docker compose exec -T db pg_isready -U footlas -d footlas >/dev/null
    docker compose exec -T db psql -q -U footlas -d footlas -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS footlas_ci WITH (FORCE)" \
      -c "CREATE DATABASE footlas_ci OWNER footlas"
    db_url="postgresql+psycopg://footlas:footlas@localhost:5434/footlas_ci"
  else
    echo "Using DATABASE_URL from your environment. Everything in its public schema will be wiped."
    CUSTOM_DB=1
  fi

  step "Backend: Python environment"
  cd "$ROOT/backend"
  if [ "$CLEAN" = 1 ]; then rm -rf .venv; fi
  if [ ! -x .venv/bin/python ]; then
    if command -v uv >/dev/null 2>&1; then
      uv venv -q -p 3.13 .venv 2>/dev/null || uv venv -q .venv
    else
      need python3 "Install Python 3.12+ (or uv: https://docs.astral.sh/uv/)."
      python3 -m venv .venv
    fi
  fi
  local stamp=.venv/.ci-local-installed
  if [ ! -f "$stamp" ] || [ pyproject.toml -nt "$stamp" ]; then
    if command -v uv >/dev/null 2>&1; then
      uv pip install -q --python .venv/bin/python -e ".[dev]"
    else
      .venv/bin/python -m pip install -q --upgrade pip
      .venv/bin/python -m pip install -q -e ".[dev]"
    fi
    touch "$stamp"
  else
    echo "Dependencies up to date (use --clean to reinstall)."
  fi
  # Same as `source .venv/bin/activate`, without depending on the activate script.
  export PATH="$ROOT/backend/.venv/bin:$PATH"
  export DATABASE_URL="$db_url"

  if [ -n "${CUSTOM_DB:-}" ]; then
    step "Postgres: reset the public schema of your DATABASE_URL"
    # The tests drop their tables but leave alembic_version behind, so start from an
    # empty schema every run, exactly like CI's fresh Postgres container.
    python - <<'PY'
import os
from sqlalchemy import create_engine, text
with create_engine(os.environ["DATABASE_URL"]).begin() as conn:
    conn.execute(text("DROP SCHEMA public CASCADE"))
    conn.execute(text("CREATE SCHEMA public"))
PY
  fi

  step "Backend: ruff check . && ruff format --check ."
  ruff check . && ruff format --check .

  step "Backend: alembic upgrade head && alembic check"
  alembic upgrade head && alembic check

  step "Backend: pytest -q"
  pytest -q
  cd "$ROOT"
}

# ---------------------------------------------------------------- frontend
run_frontend() {
  need node "Install Node 22 (CI uses 22)."
  need npm "Install Node 22 (CI uses 22)."
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" = 22 ] || echo "Note: you have Node $major, CI uses Node 22."

  cd "$ROOT/frontend"
  step "Frontend: npm ci"
  if [ "$CLEAN" = 1 ] || [ ! -f node_modules/.package-lock.json ] \
    || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    npm ci
  else
    echo "node_modules matches package-lock.json (use --clean to reinstall)."
  fi

  step "Frontend: npm run lint"
  npm run lint

  step "Frontend: npx next typegen && npx tsc --noEmit"
  npx next typegen && npx tsc --noEmit

  step "Frontend: npm run build"
  npm run build
  cd "$ROOT"
}

START=$SECONDS
[ "$RUN_BACKEND" = 1 ] && run_backend
[ "$RUN_FRONTEND" = 1 ] && run_frontend
CURRENT_STEP=""
echo; echo "${GREEN}${BOLD}Local CI passed in $((SECONDS - START))s.${RESET}"
