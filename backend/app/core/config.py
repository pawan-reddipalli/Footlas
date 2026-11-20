from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://footlas:footlas@localhost:5434/footlas"

    auth_mode: Literal["dev", "clerk"] = "dev"
    clerk_issuer: str = ""
    clerk_jwks_url: str = ""
    clerk_authorized_parties: str = ""

    cors_origins: str = "http://localhost:3000"

    @model_validator(mode="after")
    def _check_auth(self) -> "Settings":
        if self.environment == "production" and self.auth_mode != "clerk":
            raise ValueError("AUTH_MODE=dev is not allowed in production")
        # Clerk's `iss` claim has no trailing slash, and the check is an exact match.
        self.clerk_issuer = self.clerk_issuer.strip().rstrip("/")
        if self.auth_mode == "clerk":
            if not self.clerk_issuer:
                raise ValueError("AUTH_MODE=clerk needs CLERK_ISSUER (your Clerk Frontend API URL)")
            if not self.clerk_jwks_url:
                # Every Clerk instance publishes its keys at this path.
                self.clerk_jwks_url = f"{self.clerk_issuer}/.well-known/jwks.json"
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def authorized_parties(self) -> list[str]:
        return [p.strip() for p in self.clerk_authorized_parties.split(",") if p.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
