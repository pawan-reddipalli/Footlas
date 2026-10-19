"""Progress rules: users, XP and levels, streaks, statistics and achievements."""

import math
import re
import secrets
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domains.users.models import (
    Achievement,
    User,
    UserAchievement,
    UserProgress,
    UserStatistic,
)

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")

# Levels: reaching level n takes 50 * n * (n - 1) XP in total, so each level needs
# 100 XP more than the last (100, 200, 300, ...).
LEVEL_STEP = 100


@dataclass
class LevelInfo:
    level: int
    xp_into_level: int
    xp_for_next: int


def level_for(xp: int) -> LevelInfo:
    level = int((1 + math.sqrt(1 + 8 * xp / LEVEL_STEP)) // 2)
    start = LEVEL_STEP * level * (level - 1) // 2
    return LevelInfo(level=level, xp_into_level=xp - start, xp_for_next=LEVEL_STEP * level)


def _clean_username(hint: str | None) -> str | None:
    if hint and USERNAME_RE.match(hint):
        return hint
    return None


def get_or_create_user(
    db: Session, auth_id: str, username_hint: str | None = None, avatar_url: str | None = None
) -> User:
    user = db.scalar(select(User).where(User.auth_id == auth_id))
    if user:
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
            db.commit()
        return user

    username = _clean_username(username_hint)
    if username and db.scalar(select(User.id).where(User.username == username)):
        username = None
    user = User(
        auth_id=auth_id,
        username=username or f"player-{secrets.token_hex(3)}",
        avatar_url=avatar_url,
        progress=UserProgress(),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # A parallel request created the same user first.
        db.rollback()
        user = db.scalar(select(User).where(User.auth_id == auth_id))
        if user is None:
            raise
    return user


def rename_user(db: Session, user: User, username: str) -> None:
    if not USERNAME_RE.match(username):
        raise ValueError("Use 3 to 32 letters, numbers, dots, dashes or underscores")
    taken = db.scalar(select(User.id).where(User.username == username, User.id != user.id))
    if taken:
        raise ValueError("That username is taken")
    user.username = username
    db.commit()


def record_answer_stats(db: Session, user: User, keys: list[str], correct: bool) -> None:
    for key in keys:
        stat = db.scalar(
            select(UserStatistic).where(UserStatistic.user_id == user.id, UserStatistic.key == key)
        )
        if stat is None:
            stat = UserStatistic(user_id=user.id, key=key, answered=0, correct=0)
            db.add(stat)
        stat.answered += 1
        stat.correct += int(correct)
    db.flush()


def statistics(db: Session, user: User) -> dict[str, UserStatistic]:
    rows = db.scalars(select(UserStatistic).where(UserStatistic.user_id == user.id))
    return {row.key: row for row in rows}


def update_streak(progress: UserProgress, today: date) -> bool:
    """Count a finished daily challenge. Returns True if the streak grew."""
    if progress.last_daily_date == today:
        return False
    if progress.last_daily_date == today - timedelta(days=1):
        progress.current_streak += 1
    else:
        progress.current_streak = 1
    progress.longest_streak = max(progress.longest_streak, progress.current_streak)
    progress.last_daily_date = today
    return True


def live_streak(progress: UserProgress, today: date) -> int:
    """The streak as the user sees it: it lapses once a whole day is missed."""
    if progress.last_daily_date and progress.last_daily_date >= today - timedelta(days=1):
        return progress.current_streak
    return 0


def _metric_value(achievement: Achievement, progress: UserProgress, stats: dict) -> int:
    if achievement.metric == "streak":
        return progress.longest_streak
    stat = stats.get(achievement.key)
    return stat.correct if stat else 0


def check_achievements(db: Session, user: User) -> list[Achievement]:
    """Unlock every achievement whose threshold is now met. Returns the new ones."""
    owned = set(
        db.scalars(select(UserAchievement.achievement_id).where(UserAchievement.user_id == user.id))
    )
    stats = statistics(db, user)
    unlocked = []
    for achievement in db.scalars(select(Achievement).order_by(Achievement.sort_order)):
        if achievement.id in owned:
            continue
        if _metric_value(achievement, user.progress, stats) >= achievement.threshold:
            db.add(UserAchievement(user_id=user.id, achievement_id=achievement.id))
            unlocked.append(achievement)
    db.flush()
    return unlocked


def achievement_progress(db: Session, user: User) -> list[dict]:
    owned = {
        ua.achievement_id: ua.unlocked_at
        for ua in db.scalars(select(UserAchievement).where(UserAchievement.user_id == user.id))
    }
    stats = statistics(db, user)
    result = []
    for achievement in db.scalars(select(Achievement).order_by(Achievement.sort_order)):
        value = _metric_value(achievement, user.progress, stats)
        result.append(
            {
                "slug": achievement.slug,
                "name": achievement.name,
                "emoji": achievement.emoji,
                "description": achievement.description,
                "threshold": achievement.threshold,
                "progress": min(value, achievement.threshold),
                "unlocked_at": owned.get(achievement.id),
            }
        )
    return result
