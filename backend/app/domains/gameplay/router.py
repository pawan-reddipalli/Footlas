from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.auth import DB, CurrentUser
from app.domains.gameplay import service

router = APIRouter(tags=["gameplay"])


class AnswerIn(BaseModel):
    question_id: int
    # A map_id for map questions, an option id for multiple choice.
    answer: str = Field(min_length=1, max_length=64)


@router.get("/practice/next")
def next_practice(mode: Literal["map", "player"], user: CurrentUser, db: DB) -> dict:
    return service.public_question(service.next_practice_question(db, user, mode))


@router.post("/practice/answer")
def answer_practice(body: AnswerIn, user: CurrentUser, db: DB) -> dict:
    return service.answer_practice(db, user, body.question_id, body.answer)


@router.get("/daily")
def get_daily(user: CurrentUser, db: DB) -> dict:
    return service.daily_state(db, user, service.today_utc())


@router.post("/daily/answer")
def answer_daily(body: AnswerIn, user: CurrentUser, db: DB) -> dict:
    return service.answer_daily(db, user, service.today_utc(), body.question_id, body.answer)
