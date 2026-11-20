"""World Map game: find countries, players' nations, clubs and World Cup winners."""

from sqlalchemy import select

from app.domains.gameplay.models import QuizQuestion
from feature_tests.helpers import correct_answer, practice, question_by_key

MAP_KINDS = {"country_locate", "player_nationality", "club_country", "world_cup_winner"}
HOME_NATIONS = ["ENG", "SCO", "WAL", "NIR"]


def test_practice_question_has_the_map_shape_and_no_answer(client):
    for _ in range(5):
        res = client.get("/api/practice/next", params={"mode": "map"})
        assert res.status_code == 200
        q = res.json()
        assert q["mode"] == "map" and q["kind"] in MAP_KINDS
        assert q["prompt"] and q["subject"] and isinstance(q["id"], int)
        assert q["difficulty"] in (1, 2, 3)
        # Nothing that gives the game away before the user answers.
        assert not {"answer", "learn", "options", "topics"} & q.keys()


def test_every_map_kind_is_in_the_seed_data(db):
    kinds = set(db.scalars(select(QuizQuestion.kind).where(QuizQuestion.mode == "map")))
    assert kinds == MAP_KINDS


def test_correct_country_click_scores(client, db):
    q = question_by_key(db, "country_locate:BRA")
    body = practice(client, q.id, "076")
    assert body["correct"] is True and body["xp_awarded"] == 5
    assert body["answer"] == {"map_id": "076", "country": "Brazil", "flag": q.answer["flag"]}
    assert body["learn"]["title"]


def test_wrong_country_click_reveals_the_right_one(client, db):
    q = question_by_key(db, "country_locate:BRA")
    body = practice(client, q.id, "250")  # France
    assert body["correct"] is False and body["xp_awarded"] == 0
    assert body["answer"]["map_id"] == "076" and body["answer"]["country"] == "Brazil"
    assert body["learn"]["body"]


def test_home_nations_are_answered_with_the_uk_shape(client, db):
    for code in HOME_NATIONS:
        q = question_by_key(db, f"country_locate:{code}")
        assert q.answer["map_id"] == "826"
        assert practice(client, q.id, "826")["correct"], code
        assert not practice(client, q.id, "372")["correct"], code  # Ireland is not the UK
    # Players and clubs from the home nations use the same shape.
    for key in ("player_nationality:harry-kane", "club_country:celtic"):
        q = db.scalar(select(QuizQuestion).where(QuizQuestion.source_key == key))
        if q is not None:
            assert q.answer["map_id"] == "826"
            assert any("United Kingdom" in f for f in q.learn["facts"])


def test_every_map_answer_is_a_three_digit_shape_id(db):
    for q in db.scalars(select(QuizQuestion).where(QuizQuestion.mode == "map")):
        map_id = correct_answer(db, q.id)
        assert len(map_id) == 3 and map_id.isdigit(), q.source_key


def test_unknown_question_and_bad_answers_are_rejected(client):
    assert (
        client.post("/api/practice/answer", json={"question_id": 999999, "answer": "076"})
    ).status_code == 404
    assert (
        client.post("/api/practice/answer", json={"question_id": 1, "answer": ""})
    ).status_code == 422
    assert client.get("/api/practice/next", params={"mode": "chess"}).status_code == 422
