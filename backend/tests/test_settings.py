from datetime import date, datetime

from backend import clock, settings


def test_database_url_is_read_when_asked(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///one.db")
    assert settings.database_url() == "sqlite:///one.db"
    monkeypatch.setenv("DATABASE_URL", "sqlite:///two.db")
    assert settings.database_url() == "sqlite:///two.db"


def test_database_url_defaults_to_sqlite_in_data(monkeypatch):
    monkeypatch.delenv("DATABASE_URL")
    assert settings.database_url() == "sqlite:///data/accountable.db"


def test_accountable_today_is_read_when_asked(monkeypatch):
    monkeypatch.setenv("ACCOUNTABLE_TODAY", "2026-01-31")
    assert settings.fixed_today() == date(2026, 1, 31)
    monkeypatch.delenv("ACCOUNTABLE_TODAY")
    assert settings.fixed_today() is None


def test_accountable_today_fixes_today_and_now_at_noon(monkeypatch):
    monkeypatch.setenv("ACCOUNTABLE_TODAY", "2026-03-02")
    assert clock.today() == date(2026, 3, 2)
    assert clock.now() == datetime(2026, 3, 2, 12, 0)


def test_without_it_both_use_the_local_clock(monkeypatch):
    monkeypatch.delenv("ACCOUNTABLE_TODAY")
    before = datetime.now().replace(microsecond=0)
    now = clock.now()
    after = datetime.now()
    assert before <= now <= after
    assert clock.today() == date.today()
