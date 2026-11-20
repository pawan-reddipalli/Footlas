"""Load the football data and achievements, then (re)generate quiz questions.

Run with `python -m app.seed`. Safe to run repeatedly: rows are matched on their
natural keys (country code, slugs, year, source_key) and updated in place.
"""

import json
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.domains.football.models import CareerHistory, Club, Country, Player, WorldCup
from app.domains.gameplay.generator import generate_questions
from app.domains.gameplay.models import QuizQuestion
from app.domains.users.models import Achievement

DATA = Path(__file__).parent / "data"


def _load(name: str) -> list[dict]:
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def _upsert(db: Session, model, key: str, values: dict):
    row = db.scalar(select(model).where(getattr(model, key) == values[key]))
    if row is None:
        row = model(**values)
        db.add(row)
    else:
        for field, value in values.items():
            setattr(row, field, value)
    return row


def seed(db: Session) -> dict[str, int]:
    countries = {c["code"]: _upsert(db, Country, "code", c) for c in _load("countries")}
    db.flush()

    clubs = {}
    for c in _load("clubs"):
        c["country_id"] = countries[c.pop("country")].id
        clubs[c["slug"]] = _upsert(db, Club, "slug", c)
    db.flush()

    players = _load("players")
    for p in players:
        career = p.pop("career")
        current = p.pop("current_club")
        p["nationality_id"] = countries[p.pop("country")].id
        p["birth_date"] = date.fromisoformat(p["birth_date"])
        p["current_club_id"] = clubs[current].id if current else None
        player = _upsert(db, Player, "slug", p)
        player.career = [
            CareerHistory(club_id=clubs[slug].id, start_year=start, end_year=end)
            for slug, start, end in career
        ]
    db.flush()

    for wc in _load("world_cups"):
        winner = countries[wc.pop("winner")]
        _upsert(db, WorldCup, "year", {**wc, "winner_id": winner.id})

    for order, a in enumerate(_load("achievements")):
        _upsert(db, Achievement, "slug", {**a, "sort_order": order})
    db.flush()

    generated = generate_questions(db)
    keys = set()
    for q in generated:
        _upsert(db, QuizQuestion, "source_key", {**q, "active": True})
        keys.add(q["source_key"])
    # Generated questions whose source data was removed are retired, not deleted, so
    # past answers keep pointing at a real row. Hand-written kinds are left alone.
    kinds = {q["kind"] for q in generated}
    stale = select(QuizQuestion).where(
        QuizQuestion.kind.in_(kinds), QuizQuestion.source_key.not_in(keys)
    )
    for q in db.scalars(stale):
        q.active = False

    db.commit()
    return {
        "countries": len(countries),
        "clubs": len(clubs),
        "players": len(players),
        "questions": len(generated),
    }


def main() -> None:
    with SessionLocal() as db:
        counts = seed(db)
    print("Seeded " + ", ".join(f"{n} {k}" for k, n in counts.items()))


if __name__ == "__main__":
    main()
