from pathlib import Path
from typing import Any

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]

_INSECURE_DEFAULT_KEY = "change_me_in_production_use_openssl_rand_hex_32"


class Settings(BaseSettings):
    APP_NAME: str = "GPS Control API"
    APP_ENV: str = "production"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Wialon
    WIALON_BASE_URL: str | None = None
    WIALON_TOKEN: str | None = None

    # Database (SQLite for dev, PostgreSQL for prod)
    DATABASE_URL: str = "sqlite+aiosqlite:///./gpscontrol.db"

    # JWT
    SECRET_KEY: str = _INSECURE_DEFAULT_KEY
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — comma-separated list of allowed origins
    CORS_ORIGINS: str = "http://localhost:5173"

    # Admin seed (RF-07) — read by scripts/seed_admin.py
    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """Fail fast in production if critical settings use insecure defaults (ARQ-05)."""
        if self.APP_ENV == "production":
            if self.SECRET_KEY == _INSECURE_DEFAULT_KEY:
                raise ValueError(
                    "SECRET_KEY must be set to a secure random value in production. "
                    "Generate one with: openssl rand -hex 32"
                )
            if not self.WIALON_TOKEN:
                import logging
                logging.getLogger(__name__).warning(
                    "WIALON_TOKEN is not set — Wialon integration will be unavailable."
                )
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
