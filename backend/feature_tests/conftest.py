"""Fixtures for the on-demand feature tests.

These tests check every MVP feature end to end through the HTTP API. They are not part
of CI: `pytest` alone only collects `tests/` (see testpaths in pyproject.toml). Run them
with `./scripts/feature-tests.sh backend`, or `pytest feature_tests` against a scratch
database. Every table is dropped and recreated, so never point DATABASE_URL at real data.
"""

import os

os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://footlas:footlas@localhost:5434/footlas_test"
)
os.environ["AUTH_MODE"] = "dev"
os.environ["ENVIRONMENT"] = "test"

from datetime import date, timedelta  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.db import Base, SessionLocal, engine  # noqa: E402
from app.domains.gameplay import service  # noqa: E402
from app.main import app  # noqa: E402
from app.seed.__main__ import seed  # noqa: E402

USER_TABLES = [
    "quiz_answers",
    "daily_challenges",
    "user_achievements",
    "user_statistics",
    "user_progress",
    "users",
]

# A fixed "today" so streak and daily tests don't depend on the clock.
DAY_ONE = date(2031, 3, 1)


@pytest.fixture(scope="session", autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def clean_users():
    yield
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {', '.join(USER_TABLES)} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


def make_client(name: str = "tester") -> TestClient:
    return TestClient(app, headers={"X-Dev-User": name})


@pytest.fixture
def client():
    return make_client()


class Clock:
    """Moves the server's UTC day, which drives the daily challenge and streaks."""

    def __init__(self, monkeypatch):
        self.today = DAY_ONE
        monkeypatch.setattr(service, "today_utc", lambda: self.today)

    def advance(self, days: int = 1) -> date:
        self.today += timedelta(days=days)
        return self.today


@pytest.fixture
def clock(monkeypatch):
    return Clock(monkeypatch)
