import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core import auth
from app.core.config import Settings, get_settings
from app.main import app

ISSUER = "https://example.clerk.accounts.dev"


@pytest.fixture
def signing_key(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    class FakeJWKS:
        def get_signing_key_from_jwt(self, _token):
            return type("Key", (), {"key": key.public_key()})()

    monkeypatch.setattr(auth, "_jwks_client", lambda _url: FakeJWKS())
    return key


def _settings(**overrides) -> Settings:
    values = dict(
        auth_mode="clerk",
        clerk_issuer=ISSUER,
        clerk_jwks_url=f"{ISSUER}/.well-known/jwks.json",
        clerk_authorized_parties="https://footlas.app",
    )
    return Settings(**(values | overrides))


def _token(key, **claims) -> str:
    now = int(time.time())
    payload = {
        "sub": "user_123",
        "iss": ISSUER,
        "exp": now + 60,
        "iat": now,
        "azp": "https://footlas.app",
    } | claims
    return jwt.encode(payload, key, algorithm="RS256")


def test_valid_clerk_token(signing_key):
    identity = auth.verify_clerk_token(_token(signing_key), _settings())
    assert identity.auth_id == "user_123"


@pytest.mark.parametrize(
    "claims", [{"exp": 1}, {"iss": "https://evil.example"}, {"azp": "https://evil.example"}]
)
def test_rejected_clerk_tokens(signing_key, claims):
    with pytest.raises(HTTPException) as err:
        auth.verify_clerk_token(_token(signing_key, **claims), _settings())
    assert err.value.status_code == 401


def test_dev_auth_is_refused_in_production():
    with pytest.raises(ValueError):
        Settings(environment="production", auth_mode="dev")


def test_jwks_url_defaults_to_the_issuer():
    settings = Settings(auth_mode="clerk", clerk_issuer=f"{ISSUER}/")
    assert settings.clerk_issuer == ISSUER
    assert settings.clerk_jwks_url == f"{ISSUER}/.well-known/jwks.json"


def test_clerk_mode_needs_an_issuer():
    with pytest.raises(ValueError):
        Settings(auth_mode="clerk")


def test_unreachable_jwks_is_a_503(monkeypatch):
    class DownJWKS:
        def get_signing_key_from_jwt(self, _token):
            raise jwt.PyJWKClientConnectionError("down")

    monkeypatch.setattr(auth, "_jwks_client", lambda _url: DownJWKS())
    with pytest.raises(HTTPException) as err:
        auth.verify_clerk_token("a.b.c", _settings())
    assert err.value.status_code == 503


@pytest.fixture
def clerk_client(signing_key):
    """An API client running with AUTH_MODE=clerk."""
    app.dependency_overrides[get_settings] = lambda: _settings()
    yield TestClient(app)
    app.dependency_overrides.pop(get_settings, None)


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer"},
        {"Authorization": "Basic dXNlcjpwYXNz"},
        {"X-Dev-User": "sneaky"},
        {"Authorization": "Bearer not-a-jwt"},
    ],
)
def test_protected_endpoint_rejects_missing_or_bad_tokens(clerk_client, headers):
    res = clerk_client.get("/api/auth/session", headers=headers)
    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"


def test_protected_endpoint_accepts_a_clerk_session(clerk_client, signing_key):
    headers = {"Authorization": f"Bearer {_token(signing_key, sub='user_abc')}"}
    res = clerk_client.get("/api/auth/session", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["auth_mode"] == "clerk"
    assert body["auth_id"] == "user_abc"

    # The same Clerk user maps to the same Footlas user on every request.
    again = clerk_client.get("/api/auth/session", headers=headers).json()
    assert again["user_id"] == body["user_id"]
    assert clerk_client.get("/api/me", headers=headers).status_code == 200
