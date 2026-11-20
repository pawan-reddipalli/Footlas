"""The database refuses rows that break the game's rules, and migrations match the models."""

import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import CheckConstraint, select, text, update
from sqlalchemy.exc import IntegrityError

from app.core.db import Base
from app.domains.football.models import CareerHistory, Player
from app.domains.users.models import User, UserProgress

VERSIONS = Path(__file__).parent.parent / "alembic" / "versions"


def _migration(name: str):
    spec = importlib.util.spec_from_file_location(name, VERSIONS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _model_checks() -> set[str]:
    return {
        c.name
        for table in Base.metadata.tables.values()
        for c in table.constraints
        if isinstance(c, CheckConstraint)
    }


def test_migration_creates_every_check_constraint_the_models_declare():
    # Alembic autogenerate (and `alembic check` in CI) cannot see CHECK constraints.
    migrated = {
        f"ck_{table}_{name}" for table, name, _ in _migration("0002_harden_mvp_schema").CHECKS
    }
    assert migrated == _model_checks()


def test_every_foreign_key_is_indexed():
    missing = [
        f"{table.name}.{fk.parent.name}"
        for table in Base.metadata.tables.values()
        for fk in table.foreign_keys
        if not fk.parent.primary_key
        and not any(ix.columns.keys()[0] == fk.parent.name for ix in table.indexes)
        and not any(
            uq.columns.keys()[0] == fk.parent.name
            for uq in table.constraints
            if uq.__class__.__name__ == "UniqueConstraint"
        )
    ]
    assert missing == []


def _new_user(db, name="schema_tester") -> User:
    user = User(auth_id=f"dev:{name}", username=name, progress=UserProgress())
    db.add(user)
    db.flush()
    return user


@pytest.mark.parametrize(
    "values",
    [
        {"xp": -1},
        {"current_streak": -1},
        {"current_streak": 5, "longest_streak": 3},
    ],
)
def test_progress_rules_are_enforced(db, values):
    user = _new_user(db)
    with pytest.raises(IntegrityError):
        db.execute(update(UserProgress).where(UserProgress.user_id == user.id).values(**values))
    db.rollback()


def test_unknown_plan_is_rejected(db):
    db.add(User(auth_id="dev:x", username="x", plan="platinum"))
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_player_position_must_be_a_known_code(db):
    player_id = db.scalar(select(Player.id).limit(1))
    with pytest.raises(IntegrityError):
        db.execute(update(Player).where(Player.id == player_id).values(position="Striker"))
    db.rollback()


def test_career_spell_cannot_end_before_it_starts(db):
    spell = db.scalar(select(CareerHistory).limit(1))
    with pytest.raises(IntegrityError):
        db.execute(
            update(CareerHistory)
            .where(CareerHistory.id == spell.id)
            .values(end_year=spell.start_year - 1)
        )
    db.rollback()


def test_quiz_payloads_are_jsonb(db):
    types = dict(
        db.execute(
            text(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_name = 'quiz_questions' AND column_name IN ('answer', 'topics')"
            )
        ).all()
    )
    assert types == {"answer": "jsonb", "topics": "jsonb"}
