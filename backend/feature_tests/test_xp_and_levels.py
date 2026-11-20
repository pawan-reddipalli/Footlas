"""XP and levels: level n needs 100 x n more XP than the last."""

from datetime import timedelta

import pytest
from sqlalchemy import update

from app.domains.gameplay.models import QuizAnswer
from app.domains.users.service import level_for
from feature_tests.helpers import (
    correct_answer,
    play_daily,
    practice,
    question_by_key,
    wrong_answer,
)


@pytest.mark.parametrize(
    ("xp", "level", "into", "needed"),
    [
        (0, 1, 0, 100),
        (99, 1, 99, 100),
        (100, 2, 0, 200),
        (299, 2, 199, 200),
        (300, 3, 0, 300),
        (599, 3, 299, 300),
        (600, 4, 0, 400),
        (4500, 10, 0, 1000),
    ],
)
def test_level_boundaries(xp, level, into, needed):
    info = level_for(xp)
    assert (info.level, info.xp_into_level, info.xp_for_next) == (level, into, needed)


def test_levels_never_go_backwards():
    levels = [level_for(xp).level for xp in range(0, 3000)]
    assert levels == sorted(levels)


def test_practice_xp_once_per_question_per_day(client, db):
    q = question_by_key(db, "country_locate:FRA")
    assert practice(client, q.id, wrong_answer(db, q.id))["xp_awarded"] == 0
    assert practice(client, q.id, "250")["xp_awarded"] == 5  # a miss doesn't use it up
    assert practice(client, q.id, "250")["xp_awarded"] == 0
    other = question_by_key(db, "country_locate:ESP")
    assert practice(client, other.id, "724")["xp_awarded"] == 5
    assert client.get("/api/me").json()["progress"]["xp"] == 10


def test_practice_xp_comes_back_after_a_day(client, db):
    q = question_by_key(db, "country_locate:FRA")
    assert practice(client, q.id, "250")["xp_awarded"] == 5
    # Pretend that answer was given 25 hours ago.
    db.execute(update(QuizAnswer).values(created_at=QuizAnswer.created_at - timedelta(hours=25)))
    db.commit()
    assert practice(client, q.id, "250")["xp_awarded"] == 5


def test_daily_xp_values_and_level_on_profile(client, db, clock):
    items = client.get("/api/daily").json()["items"]
    qid = items[0]["question"]["id"]
    first = client.post(
        "/api/daily/answer", json={"question_id": qid, "answer": correct_answer(db, qid)}
    ).json()
    assert first["xp_awarded"] == 10 and first["progress"]["xp"] == 10

    # Finish perfectly: 10 x 10 + 20 + 50 = 170 XP, which is level 2 with 70 into it.
    for item in items[1:]:
        qid = item["question"]["id"]
        last = client.post(
            "/api/daily/answer", json={"question_id": qid, "answer": correct_answer(db, qid)}
        ).json()
    progress = client.get("/api/me").json()["progress"]
    assert last["progress"] == progress
    assert (progress["xp"], progress["level"]) == (170, 2)
    assert (progress["xp_into_level"], progress["xp_for_next"]) == (70, 200)


def test_daily_answer_does_not_use_up_practice_xp(client, db, clock):
    play_daily(client, db, correct=10)
    qid = client.get("/api/daily").json()["items"][0]["question"]["id"]
    assert practice(client, qid, correct_answer(db, qid))["xp_awarded"] == 5
