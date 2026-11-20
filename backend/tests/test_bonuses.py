from collections import defaultdict
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.domains.gameplay import bonuses, service
from app.domains.gameplay.models import QuizQuestion
from app.domains.users.models import UserStatistic
from app.domains.users.service import get_or_create_user


def _correct(q: QuizQuestion) -> str:
    return q.answer["map_id"] if q.mode == "map" else q.answer["option_id"]


def _questions_by_country(db) -> dict[str, list[QuizQuestion]]:
    by_topic = defaultdict(list)
    for q in db.scalars(select(QuizQuestion).where(QuizQuestion.active).order_by(QuizQuestion.id)):
        for topic in q.topics:
            if topic.startswith("country:"):
                by_topic[topic.removeprefix("country:")].append(q)
    return by_topic


def _smallest_country(db, at_least: int) -> tuple[str, list[QuizQuestion]]:
    options = [(c, qs) for c, qs in _questions_by_country(db).items() if len(qs) >= at_least]
    return min(options, key=lambda item: (len(item[1]), item[0]))


def _finish_daily(db, user, day: date) -> dict:
    challenge = service.get_or_create_daily(db, day)
    for qid in challenge.question_ids:
        result = service.answer_daily(db, user, day, qid, "wrong")
    return result


# Streak milestones -----------------------------------------------------------


@pytest.mark.parametrize(
    ("streak", "xp"),
    [(1, 0), (2, 0), (3, 25), (7, 50), (14, 100), (29, 0), (30, 200), (45, 0), (60, 200)],
)
def test_streak_milestone_values(streak, xp):
    assert bonuses.streak_milestone_xp(streak) == xp


def test_streak_milestone_pays_only_on_a_new_best():
    assert bonuses.streak_bonus(3, previous_best=2)["xp"] == 25
    assert bonuses.streak_bonus(3, previous_best=3) is None  # rebuilt streak: already paid
    assert bonuses.streak_bonus(4, previous_best=3) is None  # not a milestone
    assert "Hat-trick" in bonuses.streak_bonus(3, previous_best=0)["label"]
    assert "60-day" in bonuses.streak_bonus(60, previous_best=59)["label"]


def test_daily_awards_streak_milestone_once(db):
    user = get_or_create_user(db, "dev:streaky")
    start = date(2031, 3, 1)
    kinds = []
    for offset in range(3):
        result = _finish_daily(db, user, start + timedelta(days=offset))
        kinds.append([b["kind"] for b in result["bonuses"]])
    assert "streak_milestone" not in kinds[0] + kinds[1]
    milestone = next(b for b in result["bonuses"] if b["kind"] == "streak_milestone")
    assert milestone["xp"] == bonuses.STREAK_MILESTONES[3]
    assert result["summary"]["bonus_xp"] == bonuses.DAILY_COMPLETE_BONUS + milestone["xp"]

    # Miss a day, then rebuild to 3: the 3-day bonus was already earned.
    rebuild = start + timedelta(days=5)
    for offset in range(3):
        result = _finish_daily(db, user, rebuild + timedelta(days=offset))
    assert user.progress.current_streak == 3
    assert "streak_milestone" not in [b["kind"] for b in result["bonuses"]]


# Country complete --------------------------------------------------------------


def test_practice_responses_always_list_bonuses(client, db):
    question = client.get("/api/practice/next", params={"mode": "map"}).json()
    body = client.post(
        "/api/practice/answer", json={"question_id": question["id"], "answer": "999"}
    ).json()
    assert body["bonuses"] == [] and body["bonus_xp"] == 0


def test_country_bonus_after_every_question_right_once(db):
    user = get_or_create_user(db, "dev:completist")
    code, questions = _smallest_country(db, bonuses.COUNTRY_MIN_QUESTIONS)
    *first, last = questions

    # A wrong answer on the last question doesn't complete anything.
    for q in first:
        assert service.answer_practice(db, user, q.id, _correct(q))["bonuses"] == []
    assert service.answer_practice(db, user, last.id, "wrong")["bonuses"] == []

    xp_before = user.progress.xp
    result = service.answer_practice(db, user, last.id, _correct(last))
    assert [b["kind"] for b in result["bonuses"]] == ["country_complete"]
    assert result["bonuses"][0]["xp"] == bonuses.COUNTRY_COMPLETE_BONUS
    assert f"all {len(questions)} questions" in result["bonuses"][0]["label"]
    assert result["progress"]["xp"] == xp_before + service.PRACTICE_XP + result["bonus_xp"]

    stored = db.scalar(
        select(UserStatistic).where(
            UserStatistic.user_id == user.id, UserStatistic.key == f"bonus:category:{code}"
        )
    )
    assert stored is not None

    # Answering again, even right, never pays the country bonus twice.
    assert service.answer_practice(db, user, last.id, _correct(last))["bonuses"] == []


def test_country_bonus_counts_daily_answers_too(db):
    user = get_or_create_user(db, "dev:mixer")
    day = date(2031, 6, 1)
    challenge = service.get_or_create_daily(db, day)
    questions = _questions_by_country(db)
    daily_q = db.get(QuizQuestion, challenge.question_ids[0])
    code = daily_q.topics[0].removeprefix("country:")
    others = [q for q in questions[code] if q.id != daily_q.id]
    if len(questions[code]) < bonuses.COUNTRY_MIN_QUESTIONS:
        pytest.skip("first daily question's country is too small to qualify")

    for q in others:
        service.answer_practice(db, user, q.id, _correct(q))
    result = service.answer_daily(db, user, day, daily_q.id, _correct(daily_q))
    assert [b["kind"] for b in result["bonuses"]] == ["country_complete"]
    assert result["summary"]["bonus_xp"] == bonuses.COUNTRY_COMPLETE_BONUS


def test_tiny_countries_have_no_bonus(db):
    small = [qs for qs in _questions_by_country(db).values() if len(qs) < 3]
    assert small, "seed data should include a country with fewer than 3 questions"
    user = get_or_create_user(db, "dev:tiny")
    for q in small[0]:
        assert service.answer_practice(db, user, q.id, _correct(q))["bonuses"] == []
