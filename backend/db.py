"""The database engine, one transaction per request, and migrations."""

from collections.abc import Generator
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


def make_engine(url: str | None = None) -> sa.Engine:
    url = url or settings.database_url()
    engine = sa.create_engine(url)
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
    cascade, so they're off until the migration is committed, and on again after."""
    sqlite = conn.dialect.name == "sqlite"
    if sqlite:
        conn.exec_driver_sql("PRAGMA foreign_keys = OFF")
    try:
        yield
        conn.commit()
    finally:
        if sqlite:
            # The connection goes back to the pool, so it mustn't keep them off.
            conn.rollback()
            conn.exec_driver_sql("PRAGMA foreign_keys = ON")
            conn.commit()


def migrate(engine: sa.Engine) -> bool:
    """Upgrades to the latest migration. Returns True if the database was new."""
    with engine.connect() as conn, foreign_keys_off(conn):
        was_new = MigrationContext.configure(conn).get_current_revision() is None
        command.upgrade(alembic_config(conn), "head")
    return was_new
