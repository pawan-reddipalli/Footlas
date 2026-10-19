"""User domain: accounts, progress, statistics and achievements."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, TimestampMixin, utcnow


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Subject from the auth provider: a Clerk user id, or "dev:<name>" in local dev mode.
    auth_id: Mapped[str] = mapped_column(String(128), unique=True)
    username: Mapped[str] = mapped_column(String(32), unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    # Monetization hook: "free", "supporter" or "pro". Checked only through
    # app.core.entitlements so paid features never gate gameplay.
    plan: Mapped[str] = mapped_column(String(16), default="free")

    progress: Mapped["UserProgress"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )


class UserProgress(Base):
    __tablename__ = "user_progress"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    xp: Mapped[int] = mapped_column(Integer, default=0)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    # The last UTC day the user finished a daily challenge.
    last_daily_date: Mapped[date | None] = mapped_column(Date)

    user: Mapped[User] = relationship(back_populates="progress")


class UserStatistic(Base):
    """A counter per user and key, e.g. "all", "mode:map" or "country:BRA"."""

    __tablename__ = "user_statistics"
    __table_args__ = (UniqueConstraint("user_id", "key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(64))
    answered: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)


class Achievement(Base):
    """Unlocked when a metric reaches a threshold.

    metric "correct" reads UserStatistic.correct for `key`; metric "streak" reads the
    longest daily streak (key is ignored).
    """

    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    emoji: Mapped[str] = mapped_column(String(16))
    description: Mapped[str] = mapped_column(Text)
    metric: Mapped[str] = mapped_column(String(16))
    key: Mapped[str] = mapped_column(String(64), default="")
    threshold: Mapped[int] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "achievement_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    achievement_id: Mapped[int] = mapped_column(ForeignKey("achievements.id"))
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    achievement: Mapped[Achievement] = relationship()
