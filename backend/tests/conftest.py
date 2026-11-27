"""Each test gets its own SQLite file, copied from one migrated once per session, and a
fixed today of 2026-06-15 (so now is noon on that day) in the team's zone, Los Angeles.

Every test runs with the stand-in sign-in on and Supabase's settings removed, whatever the
shell has, and fails if it tries to reach the network, so no test can reach Supabase.
"""

import json
import os
import shutil
import socket
from datetime import date, datetime

import jwt
import pytest
import sqlalchemy as sa
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from jwt.algorithms import ECAlgorithm

from backend import db
from backend.services import activities, contacts, deals, organizations
from backend.tables import users
from backend.teammates import TEAMMATES

TODAY = date(2026, 6, 15)
NOW = datetime(2026, 6, 15, 12, 0)
TEAM_ZONE = "America/Los_Angeles"
SETTINGS = {
    "ACCOUNTABLE_TODAY": TODAY.isoformat(),
    "ACCOUNTABLE_TIMEZONE": TEAM_ZONE,
    "ACCOUNTABLE_STAND_IN": "1",
}
LEFT_OUT = ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "RENDER_EXTERNAL_HOSTNAME")

# backend.main makes its app as it's imported, which checks these settings, so they're in
# place before any test module imports it. Each test sets them again (database_url), so one
# test's changes can't reach the next.
os.environ.update(SETTINGS, DATABASE_URL="sqlite://")
for _name in LEFT_OUT:
    os.environ.pop(_name, None)

DANA, JOEL, NORA, WES = TEAMMATES
STAND_IN_PASSWORD = "accountable"


def sqlite_url(path) -> str:
    return f"sqlite:///{path}"


@pytest.fixture(scope="session")
def template_db(tmp_path_factory):
    """Migrated, with no records, and the four teammates in users, so records can be added
    by them."""
    path = tmp_path_factory.mktemp("template") / "template.db"
    engine = db.make_engine(sqlite_url(path))
    db.migrate(engine)
    with db.transaction(engine) as conn:
        conn.execute(users.insert(), [vars(teammate) for teammate in TEAMMATES])
    engine.dispose()
    return path


@pytest.fixture(autouse=True)
def database_url(template_db, tmp_path, monkeypatch) -> str:
    path = tmp_path / "test.db"
    shutil.copy(template_db, path)
    url = sqlite_url(path)
    monkeypatch.setenv("DATABASE_URL", url)
    for name, value in SETTINGS.items():
        monkeypatch.setenv(name, value)
    for name in LEFT_OUT:
        monkeypatch.delenv(name, raising=False)
    # npm start leaves a built frontend in frontend/dist, which would change what pages
    # outside /api answer. Only test_one_server serves one, from a folder of its own.
    monkeypatch.setattr("backend.main.FRONTEND_DIST", tmp_path / "no-build")
    return url


class NetworkBlocked(RuntimeError):
    pass


LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _is_local(address) -> bool:
    # A Unix socket's address is a path. Windows makes socket pairs by connecting to itself.
    if isinstance(address, (str, bytes)):
        return True
    return address[0] in LOCAL_HOSTS


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Any attempt to look up or connect to another computer fails the test, even if the
    code under test catches the error."""
    attempts: list = []
    real_connect, real_connect_ex = socket.socket.connect, socket.socket.connect_ex
    real_getaddrinfo = socket.getaddrinfo

    def refuse(address):
        attempts.append(address)
        raise NetworkBlocked(f"A test tried to reach {address}")

    def connect(sock, address):
        return real_connect(sock, address) if _is_local(address) else refuse(address)

    def connect_ex(sock, address):
        return real_connect_ex(sock, address) if _is_local(address) else refuse(address)

    def getaddrinfo(host, *args, **kwargs):
        if host is None or _is_local((host,)):
            return real_getaddrinfo(host, *args, **kwargs)
        return refuse(host)

    monkeypatch.setattr(socket.socket, "connect", connect)
    monkeypatch.setattr(socket.socket, "connect_ex", connect_ex)
    monkeypatch.setattr(socket, "getaddrinfo", getaddrinfo)
    yield attempts
    if attempts:
        pytest.fail(f"Tests never reach the network, but this one tried {attempts}")


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


def app_client() -> TestClient:
    # Imported here, so the settings above are in place first.
    from backend.main import create_app

    # The app answers only to this computer's names (main.ALLOWED_HOSTS).
    return TestClient(create_app(), base_url="http://localhost")


def stand_in_token(client: TestClient, email: str = DANA.email) -> str:
    response = client.post(
        "/api/stand-in/sign-in", json={"email": email, "password": STAND_IN_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def sign_in(client: TestClient, email: str = DANA.email) -> TestClient:
    """Signs the client in through the stand-in, for every request it sends after."""
    client.headers["Authorization"] = f"Bearer {stand_in_token(client, email)}"
    return client


@pytest.fixture
def client(database_url):
    """Signed in as Dana, with a stand-in token."""
    with app_client() as client:
        yield sign_in(client)


@pytest.fixture
def signed_out_client(database_url):
    with app_client() as client:
        yield client


# Supabase, played by a key pair of the tests' own (docs/specs/sign-in.md, Testing hooks).

SUPABASE_URL = "https://example.supabase.co"
SUPABASE_ISSUER = f"{SUPABASE_URL}/auth/v1"
PUBLISHABLE_KEY = "sb_publishable_test"
KEY_ID = "test-key"


@pytest.fixture(scope="session")
def supabase_keys():
    """An elliptic-curve key pair, as Supabase's asymmetric signing keys are. Made once,
    in about a millisecond."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_jwk = json.loads(ECAlgorithm.to_jwk(private_key.public_key()))
    public_jwk.update(kid=KEY_ID, alg="ES256", use="sig")
    return private_key, {"keys": [public_jwk]}


class FakeSupabase:
    """Signs tokens as Supabase would, and counts how often the backend fetches its keys."""

    def __init__(self, private_key, key_set: dict):
        self.private_key = private_key
        self.key_set = key_set
        self.fetches = 0
        self.asked_with: tuple[str, dict] | None = None  # the keys' address, and the headers

    def claims(self, **changes) -> dict:
        """A signed-in user's claims, with changes. A change to None leaves the claim out."""
        claims = {
            "sub": "5d0c3c5e-7a51-4c1e-9a52-3f0c6c7e2b11",
            "email": "sam.rivera@team.example",
            "user_metadata": {"display_name": "Sam Rivera"},
            "aud": "authenticated",
            "role": "authenticated",
            "iss": SUPABASE_ISSUER,
            "exp": int(datetime.now().timestamp()) + 3600,
            "is_anonymous": False,
            **changes,
        }
        return {name: value for name, value in claims.items() if value is not None}

    def token(self, *, key=None, algorithm: str = "ES256", headers=None, **changes) -> str:
        headers = {"kid": KEY_ID, **(headers or {})}
        return jwt.encode(
            self.claims(**changes), key or self.private_key, algorithm=algorithm, headers=headers
        )


@pytest.fixture
def supabase(monkeypatch, supabase_keys) -> FakeSupabase:
    """The backend set up for Supabase, with the stand-in off. Its public keys come from
    here instead of the network."""
    monkeypatch.setenv("SUPABASE_URL", SUPABASE_URL)
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE_KEY)
    monkeypatch.delenv("ACCOUNTABLE_STAND_IN")
    fake = FakeSupabase(*supabase_keys)

    def fetch_data(keys: jwt.PyJWKClient) -> dict:
        fake.fetches += 1
        fake.asked_with = (keys.uri, keys.headers)
        return fake.key_set

    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", fetch_data)
    return fake


@pytest.fixture
def supabase_client(supabase):
    with app_client() as client:
        yield client


class Make:
    """Small factories that add records through the services, with sensible defaults, as
    added by `by` (Dana unless another teammate's id is given).

    Given a connection, they add to its transaction. Given an engine, each one commits.
    """

    def __init__(self, target: sa.Connection | sa.Engine, by: str = DANA.id):
        self.target = target
        self.by = by

    def _add(self, add, data: dict) -> dict:
        if isinstance(self.target, sa.Engine):
            with db.transaction(self.target) as conn:
                return add(conn, data, by=self.by)
        return add(self.target, data, by=self.by)

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
