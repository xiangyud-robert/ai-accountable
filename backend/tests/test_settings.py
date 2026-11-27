from datetime import date

import pytest

from backend import settings


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


@pytest.mark.parametrize(
    ("variable", "read", "first", "second"),
    [
        ("SUPABASE_URL", settings.supabase_url, "https://a.supabase.co", "https://b.supabase.co"),
        ("SUPABASE_PUBLISHABLE_KEY", settings.supabase_publishable_key, "sb_one", "sb_two"),
        ("ACCOUNTABLE_TIMEZONE", settings.timezone_name, "Europe/London", "Asia/Tokyo"),
        ("RENDER_EXTERNAL_HOSTNAME", settings.render_hostname, "a.onrender.com", "b.onrender.com"),
    ],
)
def test_each_new_setting_is_read_when_asked(monkeypatch, variable, read, first, second):
    monkeypatch.setenv(variable, first)
    assert read() == first
    monkeypatch.setenv(variable, second)
    assert read() == second
    monkeypatch.setenv(variable, "  ")
    assert read() is None
    monkeypatch.delenv(variable)
    assert read() is None


def test_the_stand_in_is_on_only_while_its_setting_is_set(monkeypatch):
    monkeypatch.setenv("ACCOUNTABLE_STAND_IN", "1")
    assert settings.stand_in() is True
    monkeypatch.setenv("ACCOUNTABLE_STAND_IN", "")
    assert settings.stand_in() is False
    monkeypatch.delenv("ACCOUNTABLE_STAND_IN")
    assert settings.stand_in() is False


def test_the_supabase_url_loses_its_last_slash(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://a.supabase.co/")
    assert settings.supabase_url() == "https://a.supabase.co"
