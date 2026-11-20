"""Gameplay domain: questions, daily challenges and the answer log."""

from datetime import date

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin


class QuizQuestion(Base):
    """A question generated from the football data (or written by hand).

    `answer` never leaves the server before the user has answered.
    """

    __tablename__ = "quiz_questions"
    __table_args__ = (
        CheckConstraint("mode IN ('map', 'player')", name="mode"),
        CheckConstraint("difficulty BETWEEN 1 AND 5", name="difficulty"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Stable identity, e.g. "player_nationality:erling-haaland", so re-seeding updates
    # questions in place instead of duplicating them.
    source_key: Mapped[str] = mapped_column(String(128), unique=True)
    mode: Mapped[str] = mapped_column(String(16), index=True)  # "map" or "player"
    kind: Mapped[str] = mapped_column(String(32))
    prompt: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    # Public extras: clues and multiple-choice options.
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Map mode: {"map_id", "country"}. Player mode: {"option_id", "label"}.
    answer: Mapped[dict] = mapped_column(JSONB)
    # Learn Card shown after answering: {"title", "body", "facts": [...]}.
    learn: Mapped[dict] = mapped_column(JSONB)
    # Statistic keys an answer counts towards, e.g. ["country:BRA"].
    topics: Mapped[list] = mapped_column(JSONB, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class DailyChallenge(Base):
    __tablename__ = "daily_challenges"
    __table_args__ = (
        CheckConstraint("jsonb_typeof(question_ids) = 'array'", name="question_ids_is_array"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, unique=True)
    question_ids: Mapped[list] = mapped_column(JSONB)


class QuizAnswer(TimestampMixin, Base):
    __tablename__ = "quiz_answers"
    # One attempt per daily question. Practice answers have no challenge and repeat freely.
    __table_args__ = (
        UniqueConstraint("user_id", "daily_challenge_id", "question_id"),
        CheckConstraint("xp_awarded >= 0", name="xp_awarded_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("quiz_questions.id"), index=True)
    daily_challenge_id: Mapped[int | None] = mapped_column(
        ForeignKey("daily_challenges.id"), index=True
    )
    given: Mapped[str] = mapped_column(String(64))
    correct: Mapped[bool] = mapped_column(Boolean)
    xp_awarded: Mapped[int] = mapped_column(Integer, default=0)
