"""Learn Cards: every question teaches something, and every answer shows it."""

from sqlalchemy import select

from app.domains.gameplay.models import QuizQuestion
from feature_tests.helpers import correct_answer, practice, question_by_key, wrong_answer


def test_every_active_question_has_a_full_learn_card(db):
    questions = list(db.scalars(select(QuizQuestion).where(QuizQuestion.active)))
    assert len(questions) > 100
    problems = []
    for q in questions:
        learn = q.learn or {}
        if not (isinstance(learn.get("title"), str) and learn["title"].strip()):
            problems.append(f"{q.source_key}: no title")
        if not (isinstance(learn.get("body"), str) and learn["body"].strip()):
            problems.append(f"{q.source_key}: no body")
        facts = learn.get("facts")
        if not (isinstance(facts, list) and facts and all(isinstance(f, str) and f for f in facts)):
            problems.append(f"{q.source_key}: facts missing or empty")
    assert not problems, "\n".join(problems)


def test_home_nation_cards_explain_the_uk_shape(db):
    for code in ("ENG", "SCO", "WAL", "NIR"):
        facts = question_by_key(db, f"country_locate:{code}").learn["facts"]
        assert any("United Kingdom" in f for f in facts), code
    assert not any(
        "United Kingdom" in f for f in question_by_key(db, "country_locate:FRA").learn["facts"]
    )


def test_practice_answers_carry_the_learn_card_right_or_wrong(client, db):
    for key in ("country_locate:BRA", "who_am_i:harry-kane", "world_cup_winner:2014"):
        q = question_by_key(db, key)
        assert practice(client, q.id, correct_answer(db, q.id))["learn"] == q.learn
        assert practice(client, q.id, wrong_answer(db, q.id))["learn"] == q.learn


def test_daily_answers_carry_the_learn_card_and_keep_it_for_review(client, db, clock):
    item = client.get("/api/daily").json()["items"][0]
    qid = item["question"]["id"]
    q = db.get(QuizQuestion, qid)
    res = client.post("/api/daily/answer", json={"question_id": qid, "answer": "x"}).json()
    assert res["learn"] == q.learn
    review = client.get("/api/daily").json()["items"][0]["result"]
    assert review["learn"] == q.learn and review["given"] == "x"
