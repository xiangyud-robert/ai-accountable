"""Each test gets its own SQLite file, copied from one migrated once per session, and a
fixed today of 2026-06-15 (so now is noon on that day)."""

import shutil
from datetime import date, datetime

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from backend import db
from backend.main import create_app
from backend.services import activities, contacts, deals, organizations

TODAY = date(2026, 6, 15)
NOW = datetime(2026, 6, 15, 12, 0)


def sqlite_url(path) -> str:
    return f"sqlite:///{path}"


@pytest.fixture(scope="session")
def template_db(tmp_path_factory):
    path = tmp_path_factory.mktemp("template") / "template.db"
    engine = db.make_engine(sqlite_url(path))
    db.migrate(engine)
    engine.dispose()
    return path


@pytest.fixture(autouse=True)
def database_url(template_db, tmp_path, monkeypatch) -> str:
    path = tmp_path / "test.db"
    shutil.copy(template_db, path)
    url = sqlite_url(path)
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("ACCOUNTABLE_TODAY", TODAY.isoformat())
    return url


@pytest.fixture
def engine(database_url):
    engine = db.make_engine()
    yield engine
    engine.dispose()


@pytest.fixture
def conn(engine):
    """One transaction for a test that calls the services directly."""
    with db.transaction(engine) as conn:
        yield conn


@pytest.fixture
def client(database_url):
    # The app answers only to this computer's names (main.ALLOWED_HOSTS).
    with TestClient(create_app(), base_url="http://localhost") as client:
        yield client


class Make:
    """Small factories that add records through the services, with sensible defaults.

    Given a connection, they add to its transaction. Given an engine, each one commits.
    """

    def __init__(self, target: sa.Connection | sa.Engine):
        self.target = target

    def _add(self, add, data: dict) -> dict:
        if isinstance(self.target, sa.Engine):
            with db.transaction(self.target) as conn:
                return add(conn, data)
        return add(self.target, data)

    def org(self, **fields) -> dict:
        data = {"name": "Harbor Logistics", "website": None, "industry": None, "notes": None}
        return self._add(organizations.add, {**data, **fields})

    def contact(self, **fields) -> dict:
        data = {
            "name": "Priya Raman",
            "email": None,
            "phone": None,
            "job_title": None,
            "organization_id": None,
            "status": "lead",
            **fields,
        }
        return self._add(contacts.add, data)

    def deal(self, **fields) -> dict:
        data = {
            "name": "Harbor Logistics fleet analytics",
            "value": 10_000,
            "close_date": date(2026, 7, 15),
        }
        return self._add(deals.add, {**data, **fields})

    def activity(self, **fields) -> dict:
        data = {"type": "note", "description": "Spoke about the renewal.", **fields}
        return self._add(activities.add, data)


@pytest.fixture
def make(conn) -> Make:
    return Make(conn)


@pytest.fixture
def saved(engine) -> Make:
    """Factories whose records are committed, for tests that also use the client."""
    return Make(engine)
