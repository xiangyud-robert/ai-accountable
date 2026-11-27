"""The database engine, one transaction per request, and migrations."""

from collections.abc import Callable, Generator
from contextlib import contextmanager
from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import event

from backend import settings

MIGRATIONS = Path(__file__).parent / "migrations"


def _sqlite_pragmas(dbapi_connection, _record) -> None:
    # SQLite ignores foreign keys, and so the delete rules, unless each connection asks.
    # WAL lets the seed command write while the app is reading.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.close()


def _with_driver(url: sa.URL) -> sa.URL:
    # Supabase gives a postgresql:// address. psycopg is named, rather than left to
    # SQLAlchemy's default, and the older postgres:// is taken too, which SQLAlchemy refuses.
    if url.drivername in ("postgresql", "postgres"):
        return url.set(drivername="postgresql+psycopg")
    return url


def is_sqlite(url: str) -> bool:
    return sa.make_url(url).get_backend_name() == "sqlite"


def make_engine(url: str | None = None) -> sa.Engine:
    address = _with_driver(sa.make_url(url or settings.database_url()))
    if address.get_backend_name() == "postgresql":
        # Supabase's pooler drops connections left idle, as they are while Render sleeps,
        # so each one is checked before it's used and replaced if it's gone.
        return sa.create_engine(address, pool_pre_ping=True)
    engine = sa.create_engine(address)
    if engine.dialect.name == "sqlite":
        database = engine.url.database
        if database and database != ":memory:":
            Path(database).parent.mkdir(parents=True, exist_ok=True)
        event.listen(engine, "connect", _sqlite_pragmas)
    return engine


@contextmanager
def transaction(engine: sa.Engine) -> Generator[sa.Connection]:
    """Commits when the block ends normally, and rolls back everything on an error."""
    with engine.begin() as conn:
        yield conn


def alembic_config(connection: sa.Connection | None = None) -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS))
    config.attributes["connection"] = connection
    return config


@contextmanager
def foreign_keys_off(conn: sa.Connection) -> Generator[None]:
    """For migrating, from the app or the command line. Batch migrations rebuild a table by
    copying it and dropping the old one. With SQLite's foreign keys on, that drop would
    cascade, so they're off until the migration is committed, and on again after.

    SQLite's driver commits each CREATE TABLE as it goes unless a transaction is already
    open, so one is opened here (after the PRAGMA, which does nothing inside one). A failure
    partway then leaves the database as it was, on SQLite as on Postgres."""
    sqlite = conn.dialect.name == "sqlite"
    if sqlite:
        conn.exec_driver_sql("PRAGMA foreign_keys = OFF")
        conn.exec_driver_sql("BEGIN")
    try:
        yield
        conn.commit()
    finally:
        if sqlite:
            # The connection goes back to the pool, so it mustn't keep them off.
            conn.rollback()
            conn.exec_driver_sql("PRAGMA foreign_keys = ON")
            conn.commit()


def migrate(engine: sa.Engine, on_new: Callable[[sa.Connection], None] | None = None) -> bool:
    """Upgrades to the latest migration. Returns True if the database was new.

    For a new database, on_new(conn) runs inside the migration's own transaction, so on
    Postgres the tables and what on_new adds to them are saved together or not at all.
    """
    with engine.connect() as conn, foreign_keys_off(conn):
        was_new = MigrationContext.configure(conn).get_current_revision() is None
        command.upgrade(alembic_config(conn), "head")
        if was_new and on_new is not None:
            on_new(conn)
    return was_new
