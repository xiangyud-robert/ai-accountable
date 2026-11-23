"""The database engine, one transaction per request, and migrations."""

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext

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
        sa.event.listen(engine, "connect", _sqlite_pragmas)
    return engine


@contextmanager
def transaction(engine: sa.Engine) -> Iterator[sa.Connection]:
    """Commits when the block ends normally, and rolls back everything on an error."""
    with engine.begin() as conn:
        yield conn


def alembic_config(connection: sa.Connection | None = None) -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS))
    config.attributes["connection"] = connection
    return config


def migrate(engine: sa.Engine) -> bool:
    """Upgrades to the latest migration. Returns True if the database was new."""
    with engine.connect() as conn:
        sqlite = conn.dialect.name == "sqlite"
        if sqlite:
            # Batch migrations rebuild a table by copying it and dropping the old one.
            # With foreign keys on, that drop would cascade, so they're off while migrating.
            conn.exec_driver_sql("PRAGMA foreign_keys = OFF")
        was_new = MigrationContext.configure(conn).get_current_revision() is None
        command.upgrade(alembic_config(conn), "head")
        conn.commit()
        if sqlite:
            conn.exec_driver_sql("PRAGMA foreign_keys = ON")
            conn.commit()
    return was_new
