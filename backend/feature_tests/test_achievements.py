"""Achievements: every pin in achievements.json can be earned, once, and shows on /api/me.

The test drives each achievement's metric to its threshold the way a player would:
correct answers for counters, finished daily challenges for streaks and daily counts.
Long streaks start from a stored streak of threshold - 1 instead of playing 30 days.
"""

import json
from datetime import timedelta
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.domains.gameplay.models import QuizQuestion
from app.domains.users.models import UserAchievement, UserStatistic
from app.domains.users.service import get_or_create_user
from feature_tests.helpers import play_daily, practice, user_by_name

ACHIEVEMENTS = json.loads(
    (Path(__file__).parents[1] / "app" / "seed" / "data" / "achievements.json").read_text()
)


def _question_for(db, key: str) -> QuizQuestion:
    query = select(QuizQuestion).where(QuizQuestion.active).order_by(QuizQuestion.id)
    if key.startswith("mode:"):
        query = query.where(QuizQuestion.mode == key.removeprefix("mode:"))
    elif key != "all":
        query = query.where(QuizQuestion.topics.contains([key]))
    q = db.scalars(query).first()
    assert q is not None, f"no question counts toward {key!r}"
    return q


def _drive(client, db, clock, achievement: dict) -> list[str]:
    """Reach the achievement's threshold. Returns every slug unlocked along the way."""
    unlocked: list[str] = []
    key, threshold = achievement["key"], achievement["threshold"]

    if achievement["metric"] == "streak" or key == "daily:completed":
        user = get_or_create_user(db, "dev:tester", "tester")
        if achievement["metric"] == "streak":
            user.progress.current_streak = user.progress.longest_streak = threshold - 1
            user.progress.last_daily_date = clock.today - timedelta(days=1)
        else:
            db.add(
                UserStatistic(
                    user_id=user.id, key=key, answered=threshold - 1, correct=threshold - 1
                )
            )
        db.commit()
        last = play_daily(client, db, correct=0)
        return [a["slug"] for a in last["unlocked"]]

    if key == "daily:perfect":
        last = play_daily(client, db, correct=10)
        return [a["slug"] for a in last["unlocked"]]

    q = _question_for(db, key)
    answer = q.answer["map_id"] if q.mode == "map" else q.answer["option_id"]
    for _ in range(threshold):
        unlocked += [a["slug"] for a in practice(client, q.id, answer)["unlocked"]]
    return unlocked


@pytest.mark.parametrize("achievement", ACHIEVEMENTS, ids=[a["slug"] for a in ACHIEVEMENTS])
def test_each_achievement_can_be_unlocked_once(client, db, clock, achievement):
    slug = achievement["slug"]
    before = {
        a["slug"]: a for a in client.get("/api/me").json()["achievements"]
    }  # creates the user
    assert before[slug]["unlocked_at"] is None and before[slug]["progress"] == 0

    assert slug in _drive(client, db, clock, achievement)

    pin = {a["slug"]: a for a in client.get("/api/me").json()["achievements"]}[slug]
    assert pin["unlocked_at"] is not None
    assert pin["progress"] == pin["threshold"] == achievement["threshold"]

    # Going past the threshold never unlocks it a second time.
    if achievement["metric"] == "correct" and not achievement["key"].startswith("daily:"):
        q = _question_for(db, achievement["key"])
        answer = q.answer["map_id"] if q.mode == "map" else q.answer["option_id"]
        assert slug not in [a["slug"] for a in practice(client, q.id, answer)["unlocked"]]
    user = user_by_name(db)
    owned = db.scalar(
        select(func.count())
        .select_from(UserAchievement)
        .where(UserAchievement.user_id == user.id)
        .where(UserAchievement.achievement.has(slug=slug))
    )
    assert owned == 1


def test_profile_lists_every_achievement_with_capped_progress(client, db):
    q = _question_for(db, "all")
    answer = q.answer["map_id"] if q.mode == "map" else q.answer["option_id"]
    first = practice(client, q.id, answer)
    assert [a["slug"] for a in first["unlocked"]] == ["first-kick"]
    assert practice(client, q.id, answer)["unlocked"] == []
    assert practice(client, q.id, answer)["unlocked"] == []

    pins = client.get("/api/me").json()["achievements"]
    assert [p["slug"] for p in pins] == [a["slug"] for a in ACHIEVEMENTS]
    by_slug = {p["slug"]: p for p in pins}
    assert by_slug["first-kick"]["progress"] == 1  # 3 correct, capped at the threshold of 1
    assert (
        by_slug["goal-machine"]["progress"] == 3 and by_slug["goal-machine"]["unlocked_at"] is None
    )
    for pin in pins:
        assert {"name", "emoji", "description", "threshold"} <= pin.keys()
        assert 0 <= pin["progress"] <= pin["threshold"]
