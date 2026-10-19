"""Gameplay domain: questions, daily challenges and the answer log."""

from datetime import date

from sqlalchemy import JSON, Boolean, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, TimestampMixin


class QuizQuestion(Base):
    """A question generated from the football data (or written by hand).

    `answer` never leaves the server before the user has answered.
    """

    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Stable identity, e.g. "player_nationality:erling-haaland", so re-seeding updates
    # questions in place instead of duplicating them.
    source_key: Mapped[str] = mapped_column(String(128), unique=True)
    mode: Mapped[str] = mapped_column(String(16), index=True)  # "map" or "player"
    kind: Mapped[str] = mapped_column(String(32))
    prompt: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    # Public extras: clues and multiple-choice options.
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    # Map mode: {"map_id", "country"}. Player mode: {"option_id", "label"}.
    answer: Mapped[dict] = mapped_column(JSON)
    # Learn Card shown after answering: {"title", "body", "facts": [...]}.
    learn: Mapped[dict] = mapped_column(JSON)
    # Statistic keys an answer counts towards, e.g. ["country:BRA"].
    topics: Mapped[list] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class DailyChallenge(Base):
    __tablename__ = "daily_challenges"

    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, unique=True)
    question_ids: Mapped[list] = mapped_column(JSON)


class QuizAnswer(TimestampMixin, Base):
    __tablename__ = "quiz_answers"
    # One attempt per daily question. Practice answers have no challenge and repeat freely.
    __table_args__ = (UniqueConstraint("user_id", "daily_challenge_id", "question_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("quiz_questions.id"))
    daily_challenge_id: Mapped[int | None] = mapped_column(ForeignKey("daily_challenges.id"))
    given: Mapped[str] = mapped_column(String(64))
    correct: Mapped[bool] = mapped_column(Boolean)
    xp_awarded: Mapped[int] = mapped_column(Integer, default=0)
