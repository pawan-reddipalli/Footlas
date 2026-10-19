import os

os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://footlas:footlas@localhost:5432/footlas_test"
)
os.environ["AUTH_MODE"] = "dev"
os.environ["ENVIRONMENT"] = "test"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.db import Base, SessionLocal, engine  # noqa: E402
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


@pytest.fixture
def client():
    return TestClient(app, headers={"X-Dev-User": "tester"})
