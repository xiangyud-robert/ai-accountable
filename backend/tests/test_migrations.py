from contextlib import contextmanager

import sqlalchemy as sa
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext

from backend import db, tables
from backend.tests.conftest import sqlite_url


def differences_from_tables_py(conn: sa.Connection) -> list:
    # Server defaults aren't compared unless asked for.
    context = MigrationContext.configure(conn, opts={"compare_server_default": True})
    return compare_metadata(context, tables.metadata)


def test_migrations_give_exactly_the_tables_in_tables_py(tmp_path):
    engine = db.make_engine(sqlite_url(tmp_path / "empty.db"))
    assert db.migrate(engine) is True
    with engine.connect() as conn:
        differences = differences_from_tables_py(conn)
        names = set(sa.inspect(conn).get_table_names())
    engine.dispose()
    assert differences == []
    assert names == set(tables.metadata.tables) | {"alembic_version"}


def test_the_check_constraints_are_the_ones_in_tables_py(tmp_path):
    # Alembic doesn't compare CHECK constraints, so they're compared here.
    engine = db.make_engine(sqlite_url(tmp_path / "empty.db"))
    db.migrate(engine)
    inspector = sa.inspect(engine)
    normal = lambda sql: " ".join(str(sql).split())
    for table in tables.metadata.tables.values():
        expected = {
            (c.name, normal(c.sqltext))
            for c in table.constraints
            if isinstance(c, sa.CheckConstraint)
        }
        found = {
            (c["name"], normal(c["sqltext"])) for c in inspector.get_check_constraints(table.name)
        }
        assert found == expected, table.name
    engine.dispose()


def test_the_command_line_migrates_with_foreign_keys_off(tmp_path, monkeypatch):
    # `uv run alembic upgrade head` makes its own connection from DATABASE_URL.
    monkeypatch.setenv("DATABASE_URL", sqlite_url(tmp_path / "cli.db"))
    seen = []
    real = db.foreign_keys_off

    @contextmanager
    def watched(conn):
        with real(conn):
            seen.append(conn.exec_driver_sql("PRAGMA foreign_keys").scalar())
            yield
        seen.append(conn.exec_driver_sql("PRAGMA foreign_keys").scalar())

    monkeypatch.setattr(db, "foreign_keys_off", watched)
    command.upgrade(db.alembic_config(), "head")
    assert seen == [0, 1]


def test_foreign_keys_and_indexes_are_there(tmp_path):
    engine = db.make_engine(sqlite_url(tmp_path / "empty.db"))
    db.migrate(engine)
    inspector = sa.inspect(engine)
    activity_fks = {
        fk["referred_table"]: fk["options"].get("ondelete")
        for fk in inspector.get_foreign_keys("activities")
    }
    deal_fks = {
        fk["referred_table"]: fk["options"].get("ondelete")
        for fk in inspector.get_foreign_keys("deals")
    }
    deal_indexes = {tuple(ix["column_names"]) for ix in inspector.get_indexes("deals")}
    engine.dispose()
    assert activity_fks == {"contacts": "CASCADE", "deals": "CASCADE"}
    assert deal_fks == {"organizations": "SET NULL", "contacts": "SET NULL"}
    assert ("stage", "position") in deal_indexes


def test_running_them_again_does_nothing(tmp_path):
    engine = db.make_engine(sqlite_url(tmp_path / "empty.db"))
    assert db.migrate(engine) is True
    with engine.connect() as conn:
        before = MigrationContext.configure(conn).get_current_revision()
    assert db.migrate(engine) is False
    with engine.connect() as conn:
        after = MigrationContext.configure(conn).get_current_revision()
        differences = differences_from_tables_py(conn)
    engine.dispose()
    assert before == after is not None
    assert differences == []
