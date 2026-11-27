"""Concerns 16 and 18: settings that can't work stop the backend, with a message, before it starts."""

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.tests.conftest import SUPABASE_URL

POSTGRES = "postgresql://postgres.project:secret@pooler.example.com:5432/postgres"


def refusal(monkeypatch, **settings: str | None) -> str:
    for name, value in settings.items():
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)
    with pytest.raises(SystemExit) as refused:
        create_app()
    return str(refused.value)


def test_it_refuses_the_stand_in_together_with_supabase(monkeypatch):
    message = refusal(monkeypatch, ACCOUNTABLE_STAND_IN="1", SUPABASE_URL=SUPABASE_URL)
    assert "both ACCOUNTABLE_STAND_IN and SUPABASE_URL" in message


def test_it_refuses_the_stand_in_with_a_database_that_isn_t_sqlite(monkeypatch):
    message = refusal(monkeypatch, ACCOUNTABLE_STAND_IN="1", DATABASE_URL=POSTGRES)
    assert "ACCOUNTABLE_STAND_IN set and a DATABASE_URL that isn't SQLite" in message


def test_it_refuses_to_start_with_no_way_to_sign_in(monkeypatch):
    message = refusal(monkeypatch, ACCOUNTABLE_STAND_IN=None, SUPABASE_URL=None)
    assert "needs a way to sign in" in message


@pytest.mark.parametrize("zone", ["Mars/Olympus", "../../etc/passwd", "Not a zone"])
def test_it_refuses_a_time_zone_that_isn_t_one(monkeypatch, zone):
    message = refusal(monkeypatch, ACCOUNTABLE_TIMEZONE=zone)
    assert f'ACCOUNTABLE_TIMEZONE is "{zone}", which isn\'t a time zone' in message


def test_it_starts_with_the_stand_in_and_sqlite(signed_out_client):
    assert signed_out_client.get("/api/me").status_code == 401


def test_it_starts_with_supabase_and_no_stand_in_without_reaching_supabase(supabase):
    with TestClient(create_app(), base_url="http://localhost") as client:
        assert client.get("/api/me").status_code == 401
    # The keys are fetched only when a token needs checking.
    assert supabase.fetches == 0


def test_supabase_can_use_a_postgres_database(supabase, monkeypatch):
    # Only the app is made: starting it would connect to the database.
    monkeypatch.setenv("DATABASE_URL", POSTGRES)
    assert create_app() is not None


def test_without_a_time_zone_it_starts_and_uses_this_computer_s(monkeypatch):
    monkeypatch.delenv("ACCOUNTABLE_TIMEZONE")
    assert create_app() is not None
