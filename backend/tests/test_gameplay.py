from datetime import date

from sqlalchemy import func, select

from app.domains.gameplay import service
from app.domains.gameplay.models import QuizQuestion
from app.domains.users.service import get_or_create_user
from app.seed.__main__ import seed


def _correct_answer(db, question_id: int) -> str:
    q = db.get(QuizQuestion, question_id)
    return q.answer["map_id"] if q.mode == "map" else q.answer["option_id"]


def test_requests_without_identity_are_rejected(client):
    client.headers.pop("X-Dev-User")
    assert client.get("/api/me").status_code == 401


def test_questions_never_leak_the_answer(client):
    for mode in ("map", "player"):
        body = client.get("/api/practice/next", params={"mode": mode}).json()
        assert "answer" not in body and "learn" not in body
    daily = client.get("/api/daily").json()
    assert all(item["result"] is None for item in daily["items"])
    assert all("answer" not in item["question"] for item in daily["items"])


def test_practice_awards_xp_once_per_question_per_day(client, db):
    question = client.get("/api/practice/next", params={"mode": "player"}).json()
    answer = _correct_answer(db, question["id"])

    first = client.post(
        "/api/practice/answer", json={"question_id": question["id"], "answer": answer}
    )
    body = first.json()
    assert body["correct"] and body["xp_awarded"] == service.PRACTICE_XP
    assert body["learn"]["body"]
    assert [a["slug"] for a in body["unlocked"]] == ["first-kick"]

    again = client.post(
        "/api/practice/answer", json={"question_id": question["id"], "answer": answer}
    )
    assert again.json()["correct"] and again.json()["xp_awarded"] == 0


def test_wrong_answer_reveals_the_right_one(client, db):
    question = client.get("/api/practice/next", params={"mode": "map"}).json()
    body = client.post(
        "/api/practice/answer", json={"question_id": question["id"], "answer": "999"}
    ).json()
    assert not body["correct"] and body["xp_awarded"] == 0
    assert body["answer"]["map_id"] == _correct_answer(db, question["id"])


def test_home_nations_are_answered_with_the_uk_shape(db):
    q = db.scalar(
        select(QuizQuestion).where(QuizQuestion.source_key == "player_nationality:harry-kane")
    )
    assert q.answer["map_id"] == "826"
    assert any("United Kingdom" in fact for fact in q.learn["facts"])


def test_perfect_daily_challenge(client, db):
    daily = client.get("/api/daily").json()
    assert daily["summary"]["total"] == 10
    modes = [item["question"]["mode"] for item in daily["items"]]
    assert modes.count("map") == 6 and modes.count("player") == 4

    for item in daily["items"]:
        qid = item["question"]["id"]
        result = client.post(
            "/api/daily/answer", json={"question_id": qid, "answer": _correct_answer(db, qid)}
        ).json()
        assert result["correct"]

    summary = result["summary"]
    assert summary["complete"] and summary["perfect"]
    assert summary["bonus_xp"] == service.DAILY_COMPLETE_BONUS + service.DAILY_PERFECT_BONUS
    assert result["progress"]["xp"] == 10 * service.DAILY_XP + summary["bonus_xp"]
    assert result["progress"]["streak"] == 1
    assert "perfect-day" in [a["slug"] for a in result["unlocked"]]

    me = client.get("/api/me").json()
    assert me["stats"]["accuracy"] == 100 and me["stats"]["daily_completed"] == 1


def test_daily_allows_one_attempt_per_question(client, db):
    qid = client.get("/api/daily").json()["items"][0]["question"]["id"]
    assert (
        client.post("/api/daily/answer", json={"question_id": qid, "answer": "x"}).status_code
        == 200
    )
    assert (
        client.post("/api/daily/answer", json={"question_id": qid, "answer": "x"}).status_code
        == 409
    )


def test_daily_rejects_questions_from_other_days(client, db):
    today = set(i["question"]["id"] for i in client.get("/api/daily").json()["items"])
    other = db.scalar(select(QuizQuestion.id).where(QuizQuestion.id.not_in(today)))
    assert (
        client.post("/api/daily/answer", json={"question_id": other, "answer": "x"}).status_code
        == 400
    )


def test_daily_challenge_is_the_same_for_everyone(db):
    a = service.get_or_create_daily(db, date(2030, 5, 1)).question_ids
    db.rollback()
    assert service._pick_daily_questions(db, date(2030, 5, 1)) == a


def test_streak_builds_over_consecutive_days(db):
    user = get_or_create_user(db, "dev:streaker")
    for day in (date(2030, 1, 1), date(2030, 1, 2)):
        challenge = service.get_or_create_daily(db, day)
        for qid in challenge.question_ids:
            service.answer_daily(db, user, day, qid, "wrong")
    assert user.progress.current_streak == 2
    assert service.progress_summary(user, date(2030, 1, 2))["streak"] == 2


def test_profile_rename(client):
    assert client.patch("/api/me", json={"username": "x"}).status_code == 400
    body = client.patch("/api/me", json={"username": "pawan_10"}).json()
    assert body["username"] == "pawan_10" and body["plan"] == "free"


def test_reseeding_is_idempotent(db):
    before = db.scalar(select(func.count()).select_from(QuizQuestion))
    seed(db)
    assert db.scalar(select(func.count()).select_from(QuizQuestion)) == before
