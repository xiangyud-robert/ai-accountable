"""The one place that reads environment variables.

Each function reads its variable every time it's called, so tests can change them.
"""

import os
from datetime import date

DEFAULT_DATABASE_URL = "sqlite:///data/accountable.db"


def _text(name: str) -> str | None:
    """The variable's value with spaces trimmed, or None when it's missing or empty."""
    value = os.environ.get(name, "").strip()
    return value or None


def database_url() -> str:
    return _text("DATABASE_URL") or DEFAULT_DATABASE_URL


def fixed_today() -> date | None:
    value = _text("ACCOUNTABLE_TODAY")
    return date.fromisoformat(value) if value else None


def supabase_url() -> str | None:
    """The Supabase project's address, without a slash at the end."""
    value = _text("SUPABASE_URL")
    return value.rstrip("/") if value else None


def supabase_publishable_key() -> str | None:
    return _text("SUPABASE_PUBLISHABLE_KEY")


def stand_in() -> bool:
    """Concern 18: on when ACCOUNTABLE_STAND_IN is set to anything."""
    return _text("ACCOUNTABLE_STAND_IN") is not None


def timezone_name() -> str | None:
    """Concern 16: the team's time zone, such as Europe/London."""
    return _text("ACCOUNTABLE_TIMEZONE")


def render_hostname() -> str | None:
    """The onrender.com address Render gives the service."""
    return _text("RENDER_EXTERNAL_HOSTNAME")
