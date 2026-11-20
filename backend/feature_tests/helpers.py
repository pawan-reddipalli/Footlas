"""Shared helpers for the feature tests: answer questions and look up users."""

from sqlalchemy import select

from app.domains.gameplay.models import QuizQuestion
from app.domains.users.models import User


def correct_answer(db, question_id: int) -> str:
    q = db.get(QuizQuestion, question_id)
    return q.answer["map_id"] if q.mode == "map" else q.answer["option_id"]


def wrong_answer(db, question_id: int) -> str:
    q = db.get(QuizQuestion, question_id)
    if q.mode == "map":
        return "000" if q.answer["map_id"] != "000" else "001"
    return next(o["id"] for o in q.payload["options"] if o["id"] != q.answer["option_id"])


def question_by_key(db, source_key: str) -> QuizQuestion:
    q = db.scalar(select(QuizQuestion).where(QuizQuestion.source_key == source_key))
    assert q is not None, f"seed data has no question {source_key}"
    return q


def user_by_name(db, name: str = "tester") -> User:
    db.expire_all()
    return db.scalar(select(User).where(User.auth_id == f"dev:{name}"))


def practice(client, question_id: int, answer: str) -> dict:
    res = client.post("/api/practice/answer", json={"question_id": question_id, "answer": answer})
    assert res.status_code == 200, res.text
    return res.json()


def play_daily(client, db, correct: int = 10) -> dict:
    """Answer today's whole challenge, getting the first `correct` questions right.

    Returns the response to the last answer, which carries the summary and bonus.
    """
    items = client.get("/api/daily").json()["items"]
    last = None
    for i, item in enumerate(items):
        qid = item["question"]["id"]
        given = correct_answer(db, qid) if i < correct else wrong_answer(db, qid)
        res = client.post("/api/daily/answer", json={"question_id": qid, "answer": given})
        assert res.status_code == 200, res.text
        last = res.json()
    return last
