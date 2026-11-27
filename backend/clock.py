"""Today's date and the time now, on the team's clock (concern 16).

The team's clock is ACCOUNTABLE_TIMEZONE's, or this computer's own zone without one. Every
other module asks this one. Now has no zone attached, since that's how times are stored.
If ACCOUNTABLE_TODAY is set, today is that date and now is noon on it, so tests always
give the same results.
"""

from datetime import UTC, date, datetime, time, tzinfo
from zoneinfo import ZoneInfo

from backend import settings

FIXED_TIME = time(12, 0)


def real_now() -> datetime:
    """The real time, with its zone. The one place that reads the clock, so tests can replace it."""
    return datetime.now(UTC)


def team_zone() -> tzinfo | None:
    """The team's zone, or None to use this computer's own."""
    name = settings.timezone_name()
    return ZoneInfo(name) if name else None


def _on_team_clock() -> datetime:
    # astimezone(None) converts to this computer's own zone.
    return real_now().astimezone(team_zone())


def today() -> date:
    return settings.fixed_today() or _on_team_clock().date()


def now() -> datetime:
    fixed = settings.fixed_today()
    if fixed:
        return datetime.combine(fixed, FIXED_TIME)
    return _on_team_clock().replace(tzinfo=None, microsecond=0)


def to_team_clock(value: datetime) -> datetime:
    """A time sent with a zone, as the team's clock reads it, with no zone attached."""
    if value.tzinfo is None:
        return value
    return value.astimezone(team_zone()).replace(tzinfo=None)
