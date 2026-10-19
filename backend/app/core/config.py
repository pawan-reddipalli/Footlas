from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://footlas:footlas@localhost:5432/footlas"

    auth_mode: Literal["dev", "clerk"] = "dev"
    clerk_issuer: str = ""
    clerk_jwks_url: str = ""
    clerk_authorized_parties: str = ""

    cors_origins: str = "http://localhost:3000"

    @model_validator(mode="after")
    def _check_auth(self) -> "Settings":
        if self.environment == "production" and self.auth_mode != "clerk":
            raise ValueError("AUTH_MODE=dev is not allowed in production")
        if self.auth_mode == "clerk" and not (self.clerk_issuer and self.clerk_jwks_url):
            raise ValueError("AUTH_MODE=clerk needs CLERK_ISSUER and CLERK_JWKS_URL")
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
