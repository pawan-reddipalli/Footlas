"""harden mvp schema: check constraints, foreign key indexes and JSONB

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-17 04:33:24.517265

- CHECK constraints keep bad rows out even if a bug or a hand-written SQL fix slips past
  the API (e.g. a negative XP total or a player with position "Striker").
- Postgres does not index foreign keys on its own, so joins like "players of Brazil"
  or "a player's career" got sequential scans. Every foreign key now has an index.
- JSON columns become JSONB, so quiz topics and payloads can be queried and indexed
  later (e.g. "all questions about country:BRA").

Alembic autogenerate does not detect CHECK constraints, so keep this file and the
models in step by hand. tests/test_schema.py checks the two match.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, column) for every foreign key that had no index.
FK_INDEXES = [
    ("career_history", "club_id"),
    ("career_history", "player_id"),
    ("clubs", "country_id"),
    ("players", "current_club_id"),
    ("players", "nationality_id"),
    ("quiz_answers", "daily_challenge_id"),
    ("quiz_answers", "question_id"),
    ("user_achievements", "achievement_id"),
    ("world_cups", "winner_id"),
]

JSON_COLUMNS = [
    ("daily_challenges", "question_ids"),
    ("quiz_questions", "payload"),
    ("quiz_questions", "answer"),
    ("quiz_questions", "learn"),
    ("quiz_questions", "topics"),
]

# (table, name, condition). Names get the "ck_<table>_" prefix from the naming convention.
CHECKS = [
    # Football domain
    (
        "countries",
        "confederation",
        "confederation IN ('UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC')",
    ),
    ("countries", "world_cup_titles_non_negative", "world_cup_titles >= 0"),
    ("clubs", "founded", "founded IS NULL OR founded > 1800"),
    ("players", "position", "position IN ('GK', 'DF', 'MF', 'FW')"),
    ("career_history", "years_in_order", "end_year IS NULL OR end_year >= start_year"),
    # Gameplay domain
    ("quiz_questions", "mode", "mode IN ('map', 'player')"),
    ("quiz_questions", "difficulty", "difficulty BETWEEN 1 AND 5"),
    ("daily_challenges", "question_ids_is_array", "jsonb_typeof(question_ids) = 'array'"),
    ("quiz_answers", "xp_awarded_non_negative", "xp_awarded >= 0"),
    # User domain
    ("users", "plan", "plan IN ('free', 'supporter', 'pro')"),
    ("user_progress", "xp_non_negative", "xp >= 0"),
    ("user_progress", "current_streak_non_negative", "current_streak >= 0"),
    ("user_progress", "longest_streak_covers_current", "longest_streak >= current_streak"),
    ("user_statistics", "correct_within_answered", "correct >= 0 AND correct <= answered"),
    ("achievements", "metric", "metric IN ('correct', 'streak')"),
    ("achievements", "threshold_positive", "threshold > 0"),
]


def upgrade() -> None:
    for table, column in FK_INDEXES:
        op.create_index(op.f(f"ix_{table}_{column}"), table, [column], unique=False)

    for table, column in JSON_COLUMNS:
        op.alter_column(
            table,
            column,
            existing_type=postgresql.JSON(astext_type=sa.Text()),
            type_=postgresql.JSONB(astext_type=sa.Text()),
            existing_nullable=False,
            postgresql_using=f"{column}::jsonb",
        )

    # After the JSONB change: one check uses jsonb_typeof.
    for table, name, condition in CHECKS:
        op.create_check_constraint(op.f(f"ck_{table}_{name}"), table, condition)


def downgrade() -> None:
    for table, name, _ in reversed(CHECKS):
        op.drop_constraint(op.f(f"ck_{table}_{name}"), table, type_="check")

    for table, column in reversed(JSON_COLUMNS):
        op.alter_column(
            table,
            column,
            existing_type=postgresql.JSONB(astext_type=sa.Text()),
            type_=postgresql.JSON(astext_type=sa.Text()),
            existing_nullable=False,
            postgresql_using=f"{column}::json",
        )

    for table, column in reversed(FK_INDEXES):
        op.drop_index(op.f(f"ix_{table}_{column}"), table_name=table)
