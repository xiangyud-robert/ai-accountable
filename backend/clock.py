"""Today's date and the time now, on this computer's local clock.

Every other module asks this one. If ACCOUNTABLE_TODAY is set, today is that date and
now is noon on it, so tests always give the same results.
"""

from datetime import date, datetime, time

from backend import settings

FIXED_TIME = time(12, 0)


def today() -> date:
    return settings.fixed_today() or date.today()


def now() -> datetime:
    fixed = settings.fixed_today()
    if fixed:
        return datetime.combine(fixed, FIXED_TIME)
    return datetime.now().replace(microsecond=0)
