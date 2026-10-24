"""App settings, read from environment variables (and backend/.env if present)."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    # Claude writes the action-plan summary. Without a key, a rule-based plan is used instead.
    anthropic_api_key: str | None = os.getenv("ANTHROPIC_API_KEY") or None
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")

    # Free US Census geocoder (no key needed). Turn off to work fully offline.
    use_census_geocoder: bool = _flag("USE_CENSUS_GEOCODER", True)

    # Comma-separated list of origins allowed to call the API (the Vite dev server by default).
    cors_origins: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if o.strip()
    ]


settings = Settings()
