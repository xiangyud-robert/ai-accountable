"""The one place that reads environment variables.

Each function reads its variable every time it's called, so tests can change them.
"""

import os
from datetime import date

DEFAULT_DATABASE_URL = "sqlite:///data/accountable.db"


def database_url() -> str:
    return os.environ.get("DATABASE_URL") or DEFAULT_DATABASE_URL


def fixed_today() -> date | None:
    value = os.environ.get("ACCOUNTABLE_TODAY")
    return date.fromisoformat(value) if value else None
