"""Build quiz questions and their Learn Cards from the football knowledge graph.

Every question is derived from stored facts, so adding a player to the seed data adds
a map question and a "Who am I?" question, each with a Learn Card, automatically.
"""

import random

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domains.football.models import ChampionsLeagueFinal, Club, Country, Player, WorldCup

POSITIONS = {"GK": "goalkeeper", "DF": "defender", "MF": "midfielder", "FW": "forward"}
UK_SHAPE = "826"
UCL_TOPIC = "competition:ucl"


def _career_line(player: Player) -> str:
    stops = [entry.club.name for entry in player.career]
    return " → ".join(stops)


def _uk_note(country: Country) -> list[str]:
    if country.map_id == UK_SHAPE and country.code != "GBR":
        return [
            f"{country.name} is part of the United Kingdom, but it has its own national "
            "team. On the map it sits inside the UK."
        ]
    return []


def _player_facts(player: Player) -> list[str]:
    country = player.nationality
    tense = "Played" if player.retired else "Plays"
    facts = [
        f"{tense} as a {POSITIONS[player.position]} for {country.flag} {country.name}",
        f"Born {player.birth_date.day} {player.birth_date:%B %Y}",
    ]
    if player.career:
        facts.append(f"Career highlights: {_career_line(player)}")
    return facts + _uk_note(country)


def _map_answer(country: Country) -> dict:
    return {"map_id": country.map_id, "country": country.name, "flag": country.flag}


def _country_questions(countries: list[Country]) -> list[dict]:
    questions = []
    for country in countries:
        titles = country.world_cup_titles
        facts = [
            f"Confederation: {country.confederation}",
            f"World Cup titles: {titles}" if titles else "Has not won the World Cup yet",
        ]
        questions.append(
            {
                "source_key": f"country_locate:{country.code}",
                "mode": "map",
                "kind": "country_locate",
                "prompt": f"Find {country.name} on the map.",
                "difficulty": 1,
                "payload": {"subject": f"{country.flag} {country.name}"},
                "answer": _map_answer(country),
                "learn": {
                    "title": f"{country.flag} {country.name}",
                    "body": country.fact,
                    "facts": facts + _uk_note(country),
                },
                "topics": [f"country:{country.code}"],
            }
        )
    return questions


def _nationality_questions(players: list[Player]) -> list[dict]:
    return [
        {
            "source_key": f"player_nationality:{player.slug}",
            "mode": "map",
            "kind": "player_nationality",
            "prompt": f"Where is {player.name} from?",
            "difficulty": 1 if not player.retired else 2,
            "payload": {"subject": player.name},
            "answer": _map_answer(player.nationality),
            "learn": {
                "title": f"{player.name} is from {player.nationality.name}",
                "body": player.biography,
                "facts": _player_facts(player),
            },
            "topics": [f"country:{player.nationality.code}"],
        }
        for player in players
        if player.nationality.map_id
    ]


def _club_questions(clubs: list[Club]) -> list[dict]:
    questions = []
    for club in clubs:
        country = club.country
        if not club.fact or not country.map_id:
            continue
        facts = [
            f"City: {club.city}" if club.city else None,
            f"Stadium: {club.stadium}" if club.stadium else None,
            f"Founded: {club.founded}" if club.founded else None,
            f"Nickname: {club.nickname}" if club.nickname else None,
        ]
        questions.append(
            {
                "source_key": f"club_country:{club.slug}",
                "mode": "map",
                "kind": "club_country",
                "prompt": f"Which country is {club.name} from?",
                "difficulty": 2,
                "payload": {"subject": club.name},
                "answer": _map_answer(country),
                "learn": {
                    "title": f"{club.name} · {country.flag} {country.name}",
                    "body": club.fact,
                    "facts": [f for f in facts if f] + _uk_note(country),
                },
                "topics": [f"country:{country.code}"],
            }
        )
    return questions


def _world_cup_questions(world_cups: list[WorldCup]) -> list[dict]:
    return [
        {
            "source_key": f"world_cup_winner:{wc.year}",
            "mode": "map",
            "kind": "world_cup_winner",
            "prompt": f"Which country won the {wc.year} World Cup?",
            "difficulty": 2,
            "payload": {"subject": f"World Cup {wc.year}"},
            "answer": _map_answer(wc.winner),
            "learn": {
                "title": f"{wc.winner.flag} {wc.winner_name} won the {wc.year} World Cup",
                "body": wc.fact,
                "facts": [
                    f"Host: {wc.host}",
                    f"Final: {wc.winner_name} {wc.final_score} {wc.runner_up}",
                ]
                + _uk_note(wc.winner),
            },
            "topics": [f"country:{wc.winner.code}"],
        }
        for wc in world_cups
    ]


def _champions_league_questions(finals: list[ChampionsLeagueFinal]) -> list[dict]:
    questions = []
    for final in finals:
        winner, runner_up = final.winner, final.runner_up
        country = winner.country
        if not country.map_id:
            continue
        season = final.season.replace("-", "–")
        questions.append(
            {
                "source_key": f"ucl_winner_country:{final.year}",
                "mode": "map",
                "kind": "ucl_winner_country",
                "prompt": f"Which country's club won the {final.year} Champions League final?",
                "difficulty": 3,
                "payload": {"subject": f"Champions League final {final.year}"},
                "answer": _map_answer(country),
                "learn": {
                    "title": f"{winner.name} won the {season} Champions League",
                    "body": final.fact,
                    "facts": [
                        f"Club: {winner.name} ({country.flag} {country.name})",
                        f"Final: {winner.name} {final.score} {runner_up.name}",
                        f"Venue: {final.stadium}, {final.city}, {final.venue_country}",
                    ]
                    + _uk_note(country),
                },
                "topics": [UCL_TOPIC, f"country:{country.code}"],
            }
        )
    return questions


def _who_am_i_questions(players: list[Player]) -> list[dict]:
    questions = []
    for player in players:
        rng = random.Random(player.slug)
        same_position = [p for p in players if p.position == player.position and p is not player]
        others = [p for p in players if p.position != player.position]
        rng.shuffle(same_position)
        rng.shuffle(others)
        distractors = (same_position + others)[:3]
        options = [{"id": p.slug, "label": p.name} for p in [player, *distractors]]
        rng.shuffle(options)

        verb = "played" if player.retired else "play"
        clues = [
            f"I was born in {player.birth_date.year}.",
            f"I {verb} as a {POSITIONS[player.position]}.",
            f"My career includes {_career_line(player)}." if player.career else None,
            f"I represent {player.nationality.flag} {player.nationality.name}.",
        ]
        questions.append(
            {
                "source_key": f"who_am_i:{player.slug}",
                "mode": "player",
                "kind": "who_am_i",
                "prompt": "Who am I?",
                "difficulty": 2,
                "payload": {"clues": [c for c in clues if c], "options": options},
                "answer": {"option_id": player.slug, "label": player.name},
                "learn": {
                    "title": player.name,
                    "body": player.biography,
                    "facts": _player_facts(player),
                },
                "topics": [f"country:{player.nationality.code}"],
            }
        )
    return questions


def generate_questions(db: Session) -> list[dict]:
    countries = list(
        db.scalars(select(Country).where(Country.map_id.is_not(None)).order_by(Country.code))
    )
    players = list(
        db.scalars(
            select(Player)
            .options(selectinload(Player.career), selectinload(Player.nationality))
            .order_by(Player.slug)
        )
    )
    clubs = list(db.scalars(select(Club).options(selectinload(Club.country)).order_by(Club.slug)))
    world_cups = list(db.scalars(select(WorldCup).order_by(WorldCup.year)))
    finals = list(
        db.scalars(
            select(ChampionsLeagueFinal)
            .options(
                selectinload(ChampionsLeagueFinal.winner).selectinload(Club.country),
                selectinload(ChampionsLeagueFinal.runner_up),
            )
            .order_by(ChampionsLeagueFinal.year)
        )
    )
    return (
        _country_questions(countries)
        + _nationality_questions(players)
        + _club_questions(clubs)
        + _world_cup_questions(world_cups)
        + _champions_league_questions(finals)
        + _who_am_i_questions(players)
    )
