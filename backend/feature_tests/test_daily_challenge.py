"""Daily challenge: ten questions a day, one attempt each, bonus for finishing."""

from sqlalchemy import select

from app.domains.gameplay.models import QuizQuestion
from feature_tests.conftest import make_client
from feature_tests.helpers import correct_answer, play_daily, wrong_answer


def test_ten_questions_six_map_four_players(client, clock):
    daily = client.get("/api/daily").json()
    assert daily["day"] == clock.today.isoformat()
    modes = [item["question"]["mode"] for item in daily["items"]]
    assert len(modes) == 10 and modes.count("map") == 6 and modes.count("player") == 4
    assert len({item["question"]["id"] for item in daily["items"]}) == 10
    assert daily["summary"] == {
        "answered": 0,
        "correct": 0,
        "total": 10,
        "complete": False,
        "perfect": False,
    }
    for item in daily["items"]:
        assert item["result"] is None and "answer" not in item["question"]


def test_same_set_for_everyone_and_a_new_set_tomorrow(clock):
    first = [i["question"]["id"] for i in make_client("ana").get("/api/daily").json()["items"]]
    second = [i["question"]["id"] for i in make_client("ben").get("/api/daily").json()["items"]]
    assert first == second
    clock.advance()
    tomorrow = [i["question"]["id"] for i in make_client("ana").get("/api/daily").json()["items"]]
    assert tomorrow != first


def test_answers_score_ten_xp_and_show_up_in_the_state(client, db, clock):
    items = client.get("/api/daily").json()["items"]
    right, wrong = items[0]["question"]["id"], items[1]["question"]["id"]

    r = client.post(
        "/api/daily/answer", json={"question_id": right, "answer": correct_answer(db, right)}
    ).json()
    assert r["correct"] and r["xp_awarded"] == 10 and r["learn"]["body"]
    assert r["summary"]["answered"] == 1 and r["summary"]["bonus_xp"] == 0

    w = client.post(
        "/api/daily/answer", json={"question_id": wrong, "answer": wrong_answer(db, wrong)}
    ).json()
    assert not w["correct"] and w["xp_awarded"] == 0
    assert w["answer"] == db.get(QuizQuestion, wrong).answer

    state = client.get("/api/daily").json()
    assert state["items"][0]["result"]["correct"] is True
    assert state["items"][1]["result"]["given"] == wrong_answer(db, wrong)
    assert state["items"][2]["result"] is None
    assert state["progress"]["xp"] == 10


def test_one_attempt_per_question(client, db, clock):
    qid = client.get("/api/daily").json()["items"][0]["question"]["id"]
    first = client.post("/api/daily/answer", json={"question_id": qid, "answer": "x"})
    assert first.status_code == 200
    again = client.post(
        "/api/daily/answer", json={"question_id": qid, "answer": correct_answer(db, qid)}
    )
    assert again.status_code == 409
    assert client.get("/api/me").json()["progress"]["xp"] == 0


def test_question_from_another_day_is_rejected(client, db, clock):
    today = {i["question"]["id"] for i in client.get("/api/daily").json()["items"]}
    other = db.scalar(select(QuizQuestion.id).where(QuizQuestion.id.not_in(today)))
    res = client.post(
        "/api/daily/answer", json={"question_id": other, "answer": correct_answer(db, other)}
    )
    assert res.status_code == 400


def test_completion_bonus_without_perfect(client, db, clock):
    last = play_daily(client, db, correct=7)
    summary = last["summary"]
    assert summary["complete"] and not summary["perfect"]
    assert summary["correct"] == 7 and summary["bonus_xp"] == 20
    assert last["progress"]["xp"] == 7 * 10 + 20


def test_perfect_bonus(client, db, clock):
    last = play_daily(client, db, correct=10)
    assert last["summary"]["perfect"] and last["summary"]["bonus_xp"] == 20 + 50
    assert last["progress"]["xp"] == 10 * 10 + 70
    assert last["progress"]["streak"] == 1


def test_all_wrong_still_completes_and_counts(client, db, clock):
    last = play_daily(client, db, correct=0)
    assert last["summary"]["complete"] and last["summary"]["bonus_xp"] == 20
    assert last["progress"]["xp"] == 20 and last["progress"]["streak"] == 1
    assert client.get("/api/me").json()["stats"]["daily_completed"] == 1
