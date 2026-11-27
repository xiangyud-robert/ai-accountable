"""Concern 16: today and now are on the team's clock, whatever this computer's is."""

from datetime import UTC, date, datetime

import pytest

from backend import clock

# 03:00 UTC on June 15 is still the evening of June 14 in Los Angeles.
EARLY_UTC = datetime(2026, 6, 15, 3, 0, 30, 123456, tzinfo=UTC)


@pytest.fixture
def real_clock_at(monkeypatch):
    monkeypatch.delenv("ACCOUNTABLE_TODAY")

    def set_to(moment: datetime) -> None:
        monkeypatch.setattr(clock, "real_now", lambda: moment)

    return set_to


@pytest.mark.parametrize(
    ("zone", "today", "now"),
    [
        ("America/Los_Angeles", date(2026, 6, 14), datetime(2026, 6, 14, 20, 0, 30)),
        ("Europe/London", date(2026, 6, 15), datetime(2026, 6, 15, 4, 0, 30)),
        ("Asia/Tokyo", date(2026, 6, 15), datetime(2026, 6, 15, 12, 0, 30)),
    ],
)
def test_today_and_now_are_on_the_team_s_clock(real_clock_at, monkeypatch, zone, today, now):
    monkeypatch.setenv("ACCOUNTABLE_TIMEZONE", zone)
    real_clock_at(EARLY_UTC)
    assert clock.today() == today
    assert clock.now() == now
    assert clock.now().tzinfo is None


def test_accountable_today_gives_noon_on_that_date_in_the_team_s_zone(monkeypatch):
    monkeypatch.setenv("ACCOUNTABLE_TODAY", "2026-03-02")
    monkeypatch.setenv("ACCOUNTABLE_TIMEZONE", "Asia/Tokyo")
    monkeypatch.setattr(clock, "real_now", lambda: EARLY_UTC)
    assert clock.today() == date(2026, 3, 2)
    assert clock.now() == datetime(2026, 3, 2, 12, 0)


def test_without_a_team_zone_today_and_now_are_this_computer_s(real_clock_at, monkeypatch):
    monkeypatch.delenv("ACCOUNTABLE_TIMEZONE")
    real_clock_at(EARLY_UTC)
    local = EARLY_UTC.astimezone()
    assert clock.today() == local.date()
    assert clock.now() == local.replace(tzinfo=None, microsecond=0)


def test_without_a_team_zone_now_reads_the_real_local_clock(monkeypatch):
    monkeypatch.delenv("ACCOUNTABLE_TODAY")
    monkeypatch.delenv("ACCOUNTABLE_TIMEZONE")
    before = datetime.now().replace(microsecond=0)
    now = clock.now()
    after = datetime.now()
    assert before <= now <= after


def test_a_time_sent_with_a_zone_is_put_on_the_team_s_clock(monkeypatch):
    monkeypatch.setenv("ACCOUNTABLE_TIMEZONE", "Europe/London")
    assert clock.to_team_clock(EARLY_UTC) == datetime(2026, 6, 15, 4, 0, 30, 123456)
    assert clock.to_team_clock(datetime(2026, 6, 15, 9, 0)) == datetime(2026, 6, 15, 9, 0)
