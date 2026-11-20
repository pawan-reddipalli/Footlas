"""Champions League finals: seed data, generated questions and the achievement."""

import json
from pathlib import Path

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app.domains.football.models import ChampionsLeagueFinal
from app.domains.gameplay import service
from app.domains.gameplay.models import QuizQuestion
from app.domains.users.service import get_or_create_user

DATA = Path(__file__).parent.parent / "app" / "seed" / "data"
KIND = "ucl_winner_country"


def _load(name: str) -> list[dict]:
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def _ucl_questions(db) -> list[QuizQuestion]:
    return list(
        db.scalars(select(QuizQuestion).where(QuizQuestion.kind == KIND, QuizQuestion.active))
    )


def test_finals_data_is_complete_and_consistent():
    finals = _load("champions_league")
    clubs = {c["slug"] for c in _load("clubs")}
    years = [f["year"] for f in finals]
    assert years == list(range(1993, 2026)), "one final per year from 1993 to 2025"
    for final in finals:
        assert final["winner"] in clubs and final["runner_up"] in clubs
        assert final["winner"] != final["runner_up"]
        assert final["season"] == f"{final['year'] - 1}-{str(final['year'])[2:]}"
        assert final["fact"] and final["stadium"] and final["city"] and final["venue_country"]


def test_every_final_is_seeded_with_a_question_and_learn_card(db):
    assert db.scalar(select(func.count()).select_from(ChampionsLeagueFinal)) == len(
        _load("champions_league")
    )
    questions = _ucl_questions(db)
    assert len(questions) == len(_load("champions_league"))
    for q in questions:
        assert q.mode == "map" and q.answer["map_id"]
        assert q.learn["title"] and q.learn["body"]
        assert any(f.startswith("Final: ") for f in q.learn["facts"])
        assert any(f.startswith("Venue: ") for f in q.learn["facts"])
        assert "competition:ucl" in q.topics
        assert any(t.startswith("country:") for t in q.topics)


def test_learn_card_names_the_club_score_opponent_and_venue(db):
    q = db.scalar(select(QuizQuestion).where(QuizQuestion.source_key == f"{KIND}:2005"))
    assert q.prompt == "Which country's club won the 2005 Champions League final?"
    assert q.answer["map_id"] == "826"  # Liverpool: England plays on the UK shape
    assert q.topics == ["competition:ucl", "country:ENG"]
    assert "Liverpool" in q.learn["title"] and "2004–05" in q.learn["title"]
    facts = " | ".join(q.learn["facts"])
    assert "Liverpool 3–3 (3–2 on penalties) AC Milan" in facts
    assert "Istanbul" in facts and "United Kingdom" in facts


def test_ucl_questions_never_leak_the_answer(db):
    for q in _ucl_questions(db):
        public = service.public_question(q)
        assert "answer" not in public and "learn" not in public
        winner = q.learn["title"].split(" won the ")[0]
        text = json.dumps(public, ensure_ascii=False)
        assert winner not in text and q.answer["country"] not in text


def test_api_reveals_the_learn_card_only_after_answering(client, db):
    q = db.scalar(select(QuizQuestion).where(QuizQuestion.source_key == f"{KIND}:2025"))
    body = client.post(
        "/api/practice/answer", json={"question_id": q.id, "answer": q.answer["map_id"]}
    ).json()
    assert body["correct"] and body["answer"]["country"] == "France"
    assert "Paris Saint-Germain" in body["learn"]["title"]


def test_champions_league_master_unlocks_at_15_correct(db):
    user = get_or_create_user(db, "dev:ucl_fan")
    questions = _ucl_questions(db)[:15]
    for i, q in enumerate(questions, start=1):
        unlocked = service.answer_practice(db, user, q.id, q.answer["map_id"])["unlocked"]
        slugs = [a["slug"] for a in unlocked]
        assert ("champions-league-master" in slugs) == (i == 15)


def test_wrong_ucl_answers_do_not_count_towards_the_achievement(db):
    user = get_or_create_user(db, "dev:ucl_guesser")
    for q in _ucl_questions(db)[:15]:
        result = service.answer_practice(db, user, q.id, "999")
        assert not result["correct"]
        assert "champions-league-master" not in [a["slug"] for a in result["unlocked"]]


def test_a_club_cannot_beat_itself_in_a_final(db):
    final = db.scalar(select(ChampionsLeagueFinal).limit(1))
    with pytest.raises(IntegrityError):
        db.execute(
            update(ChampionsLeagueFinal)
            .where(ChampionsLeagueFinal.id == final.id)
            .values(runner_up_id=final.winner_id)
        )
    db.rollback()


def test_daily_mix_is_unchanged_by_the_new_questions(client):
    modes = [item["question"]["mode"] for item in client.get("/api/daily").json()["items"]]
    assert modes.count("map") == 6 and modes.count("player") == 4
