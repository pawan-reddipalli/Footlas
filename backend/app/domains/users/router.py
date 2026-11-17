from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import DB, CurrentIdentity, CurrentUser
from app.core.config import Settings, get_settings
from app.core.entitlements import entitlements_for
from app.domains.gameplay.service import progress_summary
from app.domains.users import service

router = APIRouter(tags=["users"])


def _profile(db: DB, user: CurrentUser) -> dict:
    stats = service.statistics(db, user)
    overall = stats.get("all")
    answered = overall.answered if overall else 0
    correct = overall.correct if overall else 0
    achievements = service.achievement_progress(db, user)
    return {
        "username": user.username,
        "avatar_url": user.avatar_url,
        "plan": user.plan,
        "entitlements": sorted(entitlements_for(user.plan)),
        "joined_at": user.created_at,
        "progress": progress_summary(user),
        "stats": {
            "answered": answered,
            "correct": correct,
            "accuracy": round(100 * correct / answered) if answered else None,
            "by_mode": {
                key.removeprefix("mode:"): {"answered": s.answered, "correct": s.correct}
                for key, s in stats.items()
                if key.startswith("mode:")
            },
            "daily_completed": stats["daily:completed"].correct
            if "daily:completed" in stats
            else 0,
        },
        "achievements": achievements,
    }


class ProfileUpdate(BaseModel):
    username: str


@router.get("/auth/session")
def get_session(
    identity: CurrentIdentity,
    user: CurrentUser,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    """The smallest protected endpoint: who the API thinks you are.

    Handy for checking a Clerk setup end to end, since it fails with 401 unless the
    session token verifies.
    """
    return {
        "auth_mode": settings.auth_mode,
        "auth_id": identity.auth_id,
        "user_id": user.id,
        "username": user.username,
    }


@router.get("/me")
def get_me(user: CurrentUser, db: DB) -> dict:
    return _profile(db, user)


@router.patch("/me")
def update_me(body: ProfileUpdate, user: CurrentUser, db: DB) -> dict:
    try:
        service.rename_user(db, user, body.username.strip())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _profile(db, user)
