"""Resolve the caller to a Footlas user.

AUTH_MODE=clerk verifies the Clerk session token in `Authorization: Bearer <jwt>`
against Clerk's JWKS. AUTH_MODE=dev trusts an `X-Dev-User` header so the app runs
locally without Clerk keys; settings refuse dev mode in production.
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.domains.users.models import User
from app.domains.users.service import get_or_create_user


@dataclass
class Identity:
    auth_id: str
    username_hint: str | None = None
    avatar_url: str | None = None


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"}
    )


def verify_clerk_token(token: str, settings: Settings) -> Identity:
    try:
        key = _jwks_client(settings.clerk_jwks_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer,
            options={"require": ["exp", "sub", "iss"]},
            leeway=5,
        )
    except jwt.PyJWKClientConnectionError as exc:
        # Clerk's key endpoint is unreachable: our problem, not a bad token.
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail="Can't reach Clerk to verify sign-in"
        ) from exc
    except jwt.PyJWTError as exc:
        raise _unauthorized("Invalid session token") from exc

    parties = settings.authorized_parties
    if parties and claims.get("azp") not in parties:
        raise _unauthorized("Token was issued for another origin")

    # Optional claims, present when the Clerk session token is customised to include them.
    return Identity(
        auth_id=claims["sub"],
        username_hint=claims.get("username"),
        avatar_url=claims.get("image_url"),
    )


def get_identity(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
    x_dev_user: Annotated[str | None, Header()] = None,
) -> Identity:
    if settings.auth_mode == "dev":
        if not x_dev_user:
            raise _unauthorized("Send X-Dev-User in dev mode")
        name = x_dev_user.strip()[:32]
        return Identity(auth_id=f"dev:{name}", username_hint=name)

    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise _unauthorized("Missing bearer token")
    return verify_clerk_token(token.strip(), settings)


def get_current_user(
    identity: Annotated[Identity, Depends(get_identity)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    return get_or_create_user(db, identity.auth_id, identity.username_hint, identity.avatar_url)


CurrentIdentity = Annotated[Identity, Depends(get_identity)]
CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]
