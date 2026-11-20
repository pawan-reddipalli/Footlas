"""champions league finals

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-20 10:00:00.000000

Adds `champions_league_finals`, one row per European Cup / Champions League final. It
powers "Which country's club won the YYYY Champions League final?" and the Champions
League Master achievement. Both club foreign keys are indexed, and the CHECK
constraints are listed in CHECKS (tests/test_schema.py compares them to the models).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "champions_league_finals"

FK_INDEXES = [
    (TABLE, "runner_up_id"),
    (TABLE, "winner_id"),
]

# (table, name, condition). Names get the "ck_<table>_" prefix from the naming convention.
CHECKS = [
    (TABLE, "year_after_first_final", "year >= 1956"),
    (TABLE, "season_format", "season ~ '^[0-9]{4}-[0-9]{2}$'"),
    (TABLE, "winner_is_not_runner_up", "winner_id <> runner_up_id"),
]


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("season", sa.String(length=7), nullable=False),
        sa.Column("winner_id", sa.Integer(), nullable=False),
        sa.Column("runner_up_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.String(length=40), nullable=False),
        sa.Column("stadium", sa.String(length=120), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=False),
        sa.Column("venue_country", sa.String(length=80), nullable=False),
        sa.Column("fact", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["winner_id"], ["clubs.id"], name=op.f(f"fk_{TABLE}_winner_id_clubs")
        ),
        sa.ForeignKeyConstraint(
            ["runner_up_id"], ["clubs.id"], name=op.f(f"fk_{TABLE}_runner_up_id_clubs")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{TABLE}")),
        sa.UniqueConstraint("year", name=op.f(f"uq_{TABLE}_year")),
    )
    for table, column in FK_INDEXES:
        op.create_index(op.f(f"ix_{table}_{column}"), table, [column], unique=False)
    for table, name, condition in CHECKS:
        op.create_check_constraint(op.f(f"ck_{table}_{name}"), table, condition)


def downgrade() -> None:
    # Dropping the table drops its indexes and constraints with it.
    op.drop_table(TABLE)
