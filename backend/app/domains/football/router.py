from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.auth import DB
from app.domains.football.models import Club, Country, Player
from app.domains.gameplay.models import QuizQuestion

router = APIRouter(tags=["football"])


@router.get("/catalog")
def catalog(db: DB) -> dict:
    """Public counts for the landing page."""

    def count(model) -> int:
        return db.scalar(select(func.count()).select_from(model)) or 0

    return {
        "countries": count(Country),
        "clubs": count(Club),
        "players": count(Player),
        "questions": db.scalar(
            select(func.count()).select_from(QuizQuestion).where(QuizQuestion.active)
        ),
    }
