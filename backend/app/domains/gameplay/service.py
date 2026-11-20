"""Game rules: serving questions, checking answers and awarding XP.

All scoring happens here on the server. Answers are revealed only in the response to
the user's own answer, so XP, streaks and (later) leaderboards can be trusted.
"""

import random
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domains.gameplay import bonuses as bonus_rules
from app.domains.gameplay.bonuses import (  # noqa: F401  (re-exported for callers)
    DAILY_COMPLETE_BONUS,
    DAILY_PERFECT_BONUS,
)
from app.domains.gameplay.models import DailyChallenge, QuizAnswer, QuizQuestion
from app.domains.users import service as users
from app.domains.users.models import Achievement, User

PRACTICE_XP = 5
DAILY_XP = 10
DAILY_MIX = {"map": 6, "player": 4}
RECENT_WINDOW = 20


class GameError(Exception):
    """A request that breaks the rules (unknown question, second attempt, ...)."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def today_utc() -> date:
    return datetime.now(UTC).date()


def public_question(question: QuizQuestion) -> dict:
    return {
        "id": question.id,
        "mode": question.mode,
        "kind": question.kind,
        "prompt": question.prompt,
        "difficulty": question.difficulty,
        **question.payload,
    }


def is_correct(question: QuizQuestion, given: str) -> bool:
    if question.mode == "map":
        return given == question.answer["map_id"]
    return given == question.answer["option_id"]


def progress_summary(user: User, today: date | None = None) -> dict:
    progress = user.progress
    level = users.level_for(progress.xp)
    return {
        "xp": progress.xp,
        "level": level.level,
        "xp_into_level": level.xp_into_level,
        "xp_for_next": level.xp_for_next,
        "streak": users.live_streak(progress, today or today_utc()),
        "longest_streak": progress.longest_streak,
    }


def _achievement_view(achievement: Achievement) -> dict:
    return {
        "slug": achievement.slug,
        "name": achievement.name,
        "emoji": achievement.emoji,
        "description": achievement.description,
    }


def _get_question(db: Session, question_id: int) -> QuizQuestion:
    question = db.get(QuizQuestion, question_id)
    if question is None or not question.active:
        raise GameError("Unknown question", 404)
    return question


def _record(
    db: Session,
    user: User,
    question: QuizQuestion,
    given: str,
    xp: int,
    challenge: DailyChallenge | None = None,
) -> bool:
    correct = is_correct(question, given)
    awarded = xp if correct else 0
    db.add(
        QuizAnswer(
            user_id=user.id,
            question_id=question.id,
            daily_challenge_id=challenge.id if challenge else None,
            given=given,
            correct=correct,
            xp_awarded=awarded,
        )
    )
    user.progress.xp += awarded
    users.record_answer_stats(db, user, ["all", f"mode:{question.mode}", *question.topics], correct)
    return correct


def _result(question: QuizQuestion, correct: bool, xp: int) -> dict:
    return {
        "correct": correct,
        "answer": question.answer,
        "learn": question.learn,
        "xp_awarded": xp,
    }


def _apply_bonuses(user: User, bonuses: list[dict]) -> int:
    total = sum(b["xp"] for b in bonuses)
    user.progress.xp += total
    return total


# Practice ------------------------------------------------------------------


def next_practice_question(db: Session, user: User, mode: str) -> QuizQuestion:
    recent = select(QuizAnswer.question_id).where(QuizAnswer.user_id == user.id)
    recent = recent.order_by(QuizAnswer.created_at.desc()).limit(RECENT_WINDOW)
    base = select(QuizQuestion).where(QuizQuestion.mode == mode, QuizQuestion.active)
    question = db.scalar(
        base.where(QuizQuestion.id.not_in(recent.scalar_subquery()))
        .order_by(func.random())
        .limit(1)
    )
    question = question or db.scalar(base.order_by(func.random()).limit(1))
    if question is None:
        raise GameError("No questions yet. Run the seed script.", 404)
    return question


def answer_practice(db: Session, user: User, question_id: int, given: str) -> dict:
    question = _get_question(db, question_id)
    # Practice XP counts once per question per day, so replaying one question can't farm XP.
    since = datetime.now(UTC) - timedelta(days=1)
    already_earned = db.scalar(
        select(QuizAnswer.id).where(
            QuizAnswer.user_id == user.id,
            QuizAnswer.question_id == question.id,
            QuizAnswer.correct,
            QuizAnswer.daily_challenge_id.is_(None),
            QuizAnswer.created_at >= since,
        )
    )
    xp = 0 if already_earned else PRACTICE_XP
    correct = _record(db, user, question, given, xp)
    bonuses = bonus_rules.country_bonuses(db, user, question) if correct else []
    bonus_xp = _apply_bonuses(user, bonuses)
    unlocked = users.check_achievements(db, user)
    db.commit()
    return {
        **_result(question, correct, xp if correct else 0),
        "bonuses": bonuses,
        "bonus_xp": bonus_xp,
        "progress": progress_summary(user),
        "unlocked": [_achievement_view(a) for a in unlocked],
    }


# Daily challenge -------------------------------------------------------------


def _pick_daily_questions(db: Session, day: date) -> list[int]:
    rng = random.Random(f"footlas-daily-{day.isoformat()}")
    picked: list[int] = []
    for mode, count in DAILY_MIX.items():
        ids = list(
            db.scalars(
                select(QuizQuestion.id)
                .where(QuizQuestion.mode == mode, QuizQuestion.active)
                .order_by(QuizQuestion.id)
            )
        )
        picked += rng.sample(ids, min(count, len(ids)))
    rng.shuffle(picked)
    return picked


def get_or_create_daily(db: Session, day: date) -> DailyChallenge:
    challenge = db.scalar(select(DailyChallenge).where(DailyChallenge.day == day))
    if challenge:
        return challenge
    question_ids = _pick_daily_questions(db, day)
    if not question_ids:
        raise GameError("No questions yet. Run the seed script.", 404)
    challenge = DailyChallenge(day=day, question_ids=question_ids)
    db.add(challenge)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        challenge = db.scalar(select(DailyChallenge).where(DailyChallenge.day == day))
    return challenge


def _daily_answers(db: Session, user: User, challenge: DailyChallenge) -> dict[int, QuizAnswer]:
    rows = db.scalars(
        select(QuizAnswer).where(
            QuizAnswer.user_id == user.id, QuizAnswer.daily_challenge_id == challenge.id
        )
    )
    return {row.question_id: row for row in rows}


def _daily_summary(challenge: DailyChallenge, answers: dict[int, QuizAnswer]) -> dict:
    total = len(challenge.question_ids)
    correct = sum(1 for a in answers.values() if a.correct)
    return {
        "answered": len(answers),
        "correct": correct,
        "total": total,
        "complete": len(answers) >= total,
        "perfect": correct == total,
    }


def daily_state(db: Session, user: User, day: date) -> dict:
    challenge = get_or_create_daily(db, day)
    answers = _daily_answers(db, user, challenge)
    questions = {
        q.id: q
        for q in db.scalars(select(QuizQuestion).where(QuizQuestion.id.in_(challenge.question_ids)))
    }
    items = []
    for qid in challenge.question_ids:
        question = questions[qid]
        answer = answers.get(qid)
        item = {"question": public_question(question), "result": None}
        if answer:
            item["result"] = {
                **_result(question, answer.correct, answer.xp_awarded),
                "given": answer.given,
            }
        items.append(item)
    return {
        "day": day.isoformat(),
        "items": items,
        "summary": _daily_summary(challenge, answers),
        "progress": progress_summary(user, day),
    }


def answer_daily(db: Session, user: User, day: date, question_id: int, given: str) -> dict:
    challenge = get_or_create_daily(db, day)
    if question_id not in challenge.question_ids:
        raise GameError("That question is not in today's challenge")
    answers = _daily_answers(db, user, challenge)
    if question_id in answers:
        raise GameError("You already answered this one today", 409)

    question = _get_question(db, question_id)
    correct = _record(db, user, question, given, DAILY_XP, challenge)
    try:
        db.flush()
    except IntegrityError as exc:  # a double-submit raced past the check above
        db.rollback()
        raise GameError("You already answered this one today", 409) from exc

    answers = _daily_answers(db, user, challenge)
    summary = _daily_summary(challenge, answers)
    bonuses = bonus_rules.country_bonuses(db, user, question) if correct else []
    if summary["complete"]:
        bonuses += bonus_rules.daily_completion_bonuses(summary["perfect"])
        previous_best = user.progress.longest_streak
        if users.update_streak(user.progress, day):
            milestone = bonus_rules.streak_bonus(user.progress.current_streak, previous_best)
            if milestone:
                bonuses.append(milestone)
        keys = ["daily:completed"] + (["daily:perfect"] if summary["perfect"] else [])
        users.record_answer_stats(db, user, keys, True)
    bonus_xp = _apply_bonuses(user, bonuses)
    unlocked = users.check_achievements(db, user)
    db.commit()
    return {
        **_result(question, correct, DAILY_XP if correct else 0),
        "bonuses": bonuses,
        # bonus_xp is every bonus earned with this answer (completion, perfect, streak, country).
        "summary": {**summary, "bonus_xp": bonus_xp},
        "progress": progress_summary(user, day),
        "unlocked": [_achievement_view(a) for a in unlocked],
    }
