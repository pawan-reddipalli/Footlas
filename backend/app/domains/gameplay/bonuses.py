"""Bonus XP: one-off rewards on top of the XP for a correct answer.

Every bonus is a dict {"kind", "label", "xp"} so the web app can show each one. Like all
scoring, bonuses are decided only here on the server.
"""

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domains.football.models import Country
from app.domains.gameplay.models import QuizAnswer, QuizQuestion
from app.domains.users.models import User, UserStatistic

DAILY_COMPLETE_BONUS = 20
DAILY_PERFECT_BONUS = 50

# Streak milestones pay out the first time a user's streak reaches them (a new personal
# best), so losing a streak and rebuilding it can't farm the same bonus twice.
STREAK_MILESTONES = {3: 25, 7: 50, 14: 100, 30: 200}
STREAK_REPEAT_EVERY = 30  # 60, 90, 120... days each pay the 30-day bonus again
STREAK_LABELS = {
    3: "Hat-trick of days: 3-day streak",
    7: "A week unbeaten: 7-day streak",
    14: "A fortnight on the bounce: 14-day streak",
    30: "A month of matchdays: 30-day streak",
}

# Country complete: every active question about a country answered correctly at least
# once (practice or daily). Countries with fewer questions than this don't count, so a
# single "find it on the map" question isn't a free bonus.
COUNTRY_COMPLETE_BONUS = 40
COUNTRY_MIN_QUESTIONS = 3
COUNTRY_TOPIC_PREFIX = "country:"
COUNTRY_BONUS_KEY = "bonus:category:{code}"


def bonus(kind: str, label: str, xp: int) -> dict:
    return {"kind": kind, "label": label, "xp": xp}


def daily_completion_bonuses(perfect: bool) -> list[dict]:
    bonuses = [bonus("daily_complete", "Daily challenge done: full-time", DAILY_COMPLETE_BONUS)]
    if perfect:
        bonuses.append(bonus("daily_perfect", "Perfect 10/10: a clean sheet", DAILY_PERFECT_BONUS))
    return bonuses


def streak_milestone_xp(streak: int) -> int:
    if streak in STREAK_MILESTONES:
        return STREAK_MILESTONES[streak]
    last = max(STREAK_MILESTONES)
    if streak > last and streak % STREAK_REPEAT_EVERY == 0:
        return STREAK_MILESTONES[last]
    return 0


def streak_bonus(streak: int, previous_best: int) -> dict | None:
    """The milestone bonus for reaching `streak`, if it is a milestone and a new best."""
    if streak <= previous_best:
        return None
    xp = streak_milestone_xp(streak)
    if not xp:
        return None
    label = STREAK_LABELS.get(streak, f"{streak}-day streak: a proper season-ticket holder")
    return bonus("streak_milestone", label, xp)


def country_bonuses(db: Session, user: User, question: QuizQuestion) -> list[dict]:
    """Award the one-off bonus for each country this correct answer completes.

    Call after the answer is flushed. The bonus is stored as a user_statistics row
    (`bonus:category:BRA`), so each user gets it at most once per country.
    """
    awarded = []
    for topic in question.topics:
        if not topic.startswith(COUNTRY_TOPIC_PREFIX):
            continue
        code = topic.removeprefix(COUNTRY_TOPIC_PREFIX)
        key = COUNTRY_BONUS_KEY.format(code=code)
        owned = db.scalar(
            select(UserStatistic.id).where(
                UserStatistic.user_id == user.id, UserStatistic.key == key
            )
        )
        if owned:
            continue
        in_topic = select(QuizQuestion.id).where(
            QuizQuestion.active, QuizQuestion.topics.contains([topic])
        )
        total = db.scalar(select(func.count()).select_from(in_topic.subquery()))
        if total < COUNTRY_MIN_QUESTIONS:
            continue
        right = db.scalar(
            select(func.count(func.distinct(QuizAnswer.question_id))).where(
                QuizAnswer.user_id == user.id,
                QuizAnswer.correct,
                QuizAnswer.question_id.in_(in_topic.scalar_subquery()),
            )
        )
        if right < total:
            continue
        try:
            with db.begin_nested():  # a parallel answer may have claimed it first
                db.add(UserStatistic(user_id=user.id, key=key, answered=1, correct=1))
        except IntegrityError:
            continue
        name = db.scalar(select(Country.name).where(Country.code == code)) or code
        awarded.append(
            bonus(
                "country_complete",
                f"{name} completed: all {total} questions right",
                COUNTRY_COMPLETE_BONUS,
            )
        )
    return awarded
