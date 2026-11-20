"""Who Am I? game: clues and four options, name the player."""

from sqlalchemy import select

from app.domains.gameplay.models import QuizQuestion
from feature_tests.helpers import practice, question_by_key


def test_question_has_clues_and_four_distinct_options(client, db):
    for _ in range(5):
        q = client.get("/api/practice/next", params={"mode": "player"}).json()
        assert q["mode"] == "player" and q["kind"] == "who_am_i" and q["prompt"] == "Who am I?"
        assert len(q["clues"]) >= 3 and all(q["clues"])
        ids = [o["id"] for o in q["options"]]
        assert len(ids) == 4 and len(set(ids)) == 4
        assert all(o["label"] for o in q["options"])
        assert "answer" not in q and "learn" not in q
        # The right player is always one of the options.
        assert db.get(QuizQuestion, q["id"]).answer["option_id"] in ids


def test_every_who_am_i_question_offers_its_answer(db):
    questions = list(db.scalars(select(QuizQuestion).where(QuizQuestion.mode == "player")))
    assert questions
    for q in questions:
        assert q.answer["option_id"] in {o["id"] for o in q.payload["options"]}, q.source_key


def test_correct_option_scores(client, db):
    q = question_by_key(db, "who_am_i:harry-kane")
    body = practice(client, q.id, "harry-kane")
    assert body["correct"] is True and body["xp_awarded"] == 5
    assert body["answer"] == {"option_id": "harry-kane", "label": "Harry Kane"}
    assert body["learn"]["title"] == "Harry Kane"


def test_wrong_option_reveals_the_player(client, db):
    q = question_by_key(db, "who_am_i:harry-kane")
    wrong = next(o["id"] for o in q.payload["options"] if o["id"] != "harry-kane")
    body = practice(client, q.id, wrong)
    assert body["correct"] is False and body["xp_awarded"] == 0
    assert body["answer"]["option_id"] == "harry-kane"
    assert body["answer"]["label"] == "Harry Kane"
    assert body["learn"]["body"]
