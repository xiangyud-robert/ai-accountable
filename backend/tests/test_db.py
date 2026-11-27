from datetime import date

import pytest
import sqlalchemy as sa

from backend import db
from backend.services import deals
from backend.tables import (
    contacts,
    organizations,
    stage_changes,
    status_changes,
)
from backend.tables import (
    deals as deals_table,
)
from backend.tests.conftest import DANA, Make, app_client, sign_in, sqlite_url


def test_foreign_keys_and_wal_are_on_for_a_new_connection(engine):
    with engine.connect() as conn:
        assert conn.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
        assert conn.exec_driver_sql("PRAGMA journal_mode").scalar() == "wal"


def test_transaction_commits_on_success(engine):
    with db.transaction(engine) as conn:
        Make(conn).org(name="Kept")
    with engine.connect() as conn:
        assert conn.execute(sa.select(organizations.c.name)).scalars().all() == ["Kept"]


def test_transaction_rolls_back_everything_on_an_error(engine):
    with pytest.raises(RuntimeError), db.transaction(engine) as conn:
        Make(conn).org(name="Gone")
        raise RuntimeError("partway")
    with engine.connect() as conn:
        assert conn.execute(sa.select(sa.func.count()).select_from(organizations)).scalar() == 0


def test_a_move_to_won_that_fails_partway_changes_nothing(engine, monkeypatch):
    with db.transaction(engine) as conn:
        make = Make(conn)
        contact = make.contact(status="qualified")
        deal = make.deal(contact_id=contact["id"], stage="negotiation", close_date=date(2026, 7, 1))

    def broken_set_status(*args, **kwargs):
        raise RuntimeError("the contact couldn't be changed")

    monkeypatch.setattr(deals.contacts_service, "set_status", broken_set_status)
    with pytest.raises(RuntimeError), db.transaction(engine) as conn:
        deals.move(conn, deal["id"], "won", 0, by=DANA.id)

    with engine.connect() as conn:
        row = conn.execute(sa.select(deals_table).where(deals_table.c.id == deal["id"])).one()
        history = conn.execute(sa.select(stage_changes.c.to_stage)).scalars().all()
        status = conn.execute(sa.select(contacts.c.status)).scalar_one()
        status_count = conn.execute(sa.select(sa.func.count()).select_from(status_changes)).scalar()
    assert (row.stage, row.probability, row.close_date) == ("negotiation", 75, date(2026, 7, 1))
    assert history == ["negotiation"]
    assert status == "qualified"
    assert status_count == 0


def test_r14_data_is_still_there_after_a_second_app_on_the_same_file(client, database_url):
    client.post("/api/organizations", json={"name": "Still here"})
    with app_client() as restarted:
        names = [o["name"] for o in sign_in(restarted).get("/api/organizations").json()]
    assert "Still here" in names


def test_a_new_database_is_migrated_and_gets_the_sample_data(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", sqlite_url(tmp_path / "brand-new" / "accountable.db"))
    with app_client() as client:
        sign_in(client)
        assert len(client.get("/api/organizations").json()) == 15
        assert len(client.get("/api/deals").json()) == 45


def test_a_migrated_database_isnt_reseeded_even_when_empty(client):
    # The test database is already migrated, with no rows in it.
    assert client.get("/api/organizations").json() == []
    assert client.get("/api/deals").json() == []


@pytest.mark.parametrize("scheme", ["postgresql", "postgres"])
def test_a_postgres_url_as_supabase_gives_it_uses_psycopg_without_connecting(scheme):
    engine = db.make_engine(f"{scheme}://someone:secret@pooler.example.com:5432/postgres")
    # No connection is made, or the network guard in conftest would fail the test.
    assert (engine.dialect.name, engine.dialect.driver) == ("postgresql", "psycopg")
    # Each connection is checked before use, since the pooler drops idle ones.
    assert engine.pool._pre_ping is True
    engine.dispose()


def test_only_sqlite_urls_count_as_sqlite():
    assert db.is_sqlite("sqlite:///data/accountable.db")
    assert not db.is_sqlite("postgresql://someone@pooler.example.com:5432/postgres")
