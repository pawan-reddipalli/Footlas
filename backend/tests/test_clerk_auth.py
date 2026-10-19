import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.core import auth
from app.core.config import Settings

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
