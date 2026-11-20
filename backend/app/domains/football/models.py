"""Football domain: the knowledge graph every game and Learn Card is built from.

Each fact is stored once and linked by id, so one player row powers map questions,
player questions and Learn Cards alike.
"""

from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Country(Base):
    __tablename__ = "countries"
    __table_args__ = (
        CheckConstraint(
            "confederation IN ('UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC')",
            name="confederation",
        ),
        CheckConstraint("world_cup_titles >= 0", name="world_cup_titles_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Football code (FIFA-style), e.g. ENG, BRA. England and Scotland get their own rows.
    code: Mapped[str] = mapped_column(String(3), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    # ISO 3166-1 numeric id of the shape on the world map. England, Scotland, Wales and
    # Northern Ireland share the United Kingdom's shape (826). Null = not on the map.
    map_id: Mapped[str | None] = mapped_column(String(3), index=True)
    confederation: Mapped[str] = mapped_column(String(16))
    flag: Mapped[str] = mapped_column(String(16))
    world_cup_titles: Mapped[int] = mapped_column(Integer, default=0)
    fact: Mapped[str] = mapped_column(Text)

    players: Mapped[list["Player"]] = relationship(back_populates="nationality")
    clubs: Mapped[list["Club"]] = relationship(back_populates="country")


class Club(Base):
    __tablename__ = "clubs"
    __table_args__ = (CheckConstraint("founded IS NULL OR founded > 1800", name="founded"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    country_id: Mapped[int] = mapped_column(ForeignKey("countries.id"), index=True)
    city: Mapped[str | None] = mapped_column(String(80))
    stadium: Mapped[str | None] = mapped_column(String(120))
    founded: Mapped[int | None] = mapped_column(Integer)
    nickname: Mapped[str | None] = mapped_column(String(80))
    # Clubs with a fact get their own "which country?" question.
    fact: Mapped[str | None] = mapped_column(Text)

    country: Mapped[Country] = relationship(back_populates="clubs")


class Player(Base):
    __tablename__ = "players"
    __table_args__ = (CheckConstraint("position IN ('GK', 'DF', 'MF', 'FW')", name="position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    nationality_id: Mapped[int] = mapped_column(ForeignKey("countries.id"), index=True)
    current_club_id: Mapped[int | None] = mapped_column(ForeignKey("clubs.id"), index=True)
    position: Mapped[str] = mapped_column(String(16))  # GK, DF, MF, FW
    birth_date: Mapped[date] = mapped_column(Date)
    retired: Mapped[bool] = mapped_column(default=False)
    image: Mapped[str | None] = mapped_column(String(255))
    biography: Mapped[str] = mapped_column(Text)

    nationality: Mapped[Country] = relationship(back_populates="players")
    current_club: Mapped[Club | None] = relationship()
    career: Mapped[list["CareerHistory"]] = relationship(
        back_populates="player", order_by="CareerHistory.start_year", cascade="all, delete-orphan"
    )


class CareerHistory(Base):
    """A senior spell at a club. Careers list the notable spells, not every loan."""

    __tablename__ = "career_history"
    __table_args__ = (
        CheckConstraint("end_year IS NULL OR end_year >= start_year", name="years_in_order"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), index=True)
    club_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"), index=True)
    start_year: Mapped[int] = mapped_column(Integer)
    end_year: Mapped[int | None] = mapped_column(Integer)  # null = still there

    player: Mapped[Player] = relationship(back_populates="career")
    club: Mapped[Club] = relationship()


class WorldCup(Base):
    __tablename__ = "world_cups"

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int] = mapped_column(Integer, unique=True)
    host: Mapped[str] = mapped_column(String(80))
    winner_id: Mapped[int] = mapped_column(ForeignKey("countries.id"), index=True)
    # Name the winner played under that year, e.g. "West Germany".
    winner_name: Mapped[str] = mapped_column(String(80))
    runner_up: Mapped[str] = mapped_column(String(80))
    final_score: Mapped[str] = mapped_column(String(40))
    fact: Mapped[str] = mapped_column(Text)

    winner: Mapped[Country] = relationship()


class ChampionsLeagueFinal(Base):
    """A European Cup / Champions League final. `year` is the year the final was played."""

    __tablename__ = "champions_league_finals"
    __table_args__ = (
        CheckConstraint("year >= 1956", name="year_after_first_final"),
        CheckConstraint("season ~ '^[0-9]{4}-[0-9]{2}$'", name="season_format"),
        CheckConstraint("winner_id <> runner_up_id", name="winner_is_not_runner_up"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int] = mapped_column(Integer, unique=True)
    season: Mapped[str] = mapped_column(String(7))  # e.g. "2004-05"
    winner_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"), index=True)
    runner_up_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"), index=True)
    # Winner's score first, e.g. "3–3 (3–2 on penalties)".
    score: Mapped[str] = mapped_column(String(40))
    stadium: Mapped[str] = mapped_column(String(120))
    city: Mapped[str] = mapped_column(String(80))
    venue_country: Mapped[str] = mapped_column(String(80))
    fact: Mapped[str] = mapped_column(Text)

    winner: Mapped[Club] = relationship(foreign_keys=[winner_id])
    runner_up: Mapped[Club] = relationship(foreign_keys=[runner_up_id])
