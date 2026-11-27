import io
import re
from contextlib import contextmanager

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import event

from backend import db, tables
from backend.tests.conftest import sqlite_url

RECORD_TABLES = ("organizations", "contacts", "deals", "activities")


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
        (fk["constrained_columns"][0], fk["referred_table"]): fk["options"].get("ondelete")
        for fk in inspector.get_foreign_keys("activities")
    }
    deal_fks = {
        (fk["constrained_columns"][0], fk["referred_table"]): fk["options"].get("ondelete")
        for fk in inspector.get_foreign_keys("deals")
    }
    indexes = {
        table: {tuple(ix["column_names"]) for ix in inspector.get_indexes(table)}
        for table in RECORD_TABLES
    }
    people_fks = {
        table: {
            fk["constrained_columns"][0]
            for fk in inspector.get_foreign_keys(table)
            if fk["referred_table"] == "users"
        }
        for table in RECORD_TABLES
    }
    engine.dispose()
    people = {("created_by", "users"): None, ("updated_by", "users"): None}
    assert activity_fks == {
        ("contact_id", "contacts"): "CASCADE",
        ("deal_id", "deals"): "CASCADE",
        **people,
    }
    assert deal_fks == {
        ("organization_id", "organizations"): "SET NULL",
        ("contact_id", "contacts"): "SET NULL",
        **people,
    }
    assert ("stage", "position") in indexes["deals"]
    for table in RECORD_TABLES:
        assert people_fks[table] == {"created_by", "updated_by"}, table
        assert {("created_by",), ("updated_by",)} <= indexes[table], table


def test_a_database_from_before_sign_in_keeps_its_records_with_no_one_recorded(tmp_path):
    engine = db.make_engine(sqlite_url(tmp_path / "older.db"))
    with engine.connect() as conn, db.foreign_keys_off(conn):
        command.upgrade(db.alembic_config(conn), "0001")
    with db.transaction(engine) as conn:
        conn.exec_driver_sql(
            "INSERT INTO organizations (name, created_at, updated_at)"
            " VALUES ('Harbor Logistics', '2026-01-02 09:00:00', '2026-01-02 09:00:00')"
        )
    assert db.migrate(engine) is False
    with engine.connect() as conn:
        row = conn.execute(sa.select(tables.organizations)).one()
        differences = differences_from_tables_py(conn)
    engine.dispose()
    assert (row.name, row.created_by, row.updated_by) == ("Harbor Logistics", None, None)
    assert differences == []


def postgres_sql_of_every_migration() -> str:
    """Every migration's upgrade as Postgres would get it, rendered without connecting."""
    output = io.StringIO()
    context = MigrationContext.configure(
        dialect_name="postgresql", opts={"as_sql": True, "output_buffer": output}
    )
    scripts = ScriptDirectory.from_config(db.alembic_config())
    with Operations.context(context):
        for revision in reversed(list(scripts.walk_revisions())):
            revision.module.upgrade()
    return output.getvalue()


def test_concern_17_every_table_gets_row_level_security_on_postgres():
    sql = postgres_sql_of_every_migration()
    secured = set(re.findall(r"ALTER TABLE (\w+) ENABLE ROW LEVEL SECURITY", sql))
    assert secured == set(tables.metadata.tables) | {"alembic_version"}


def test_row_level_security_is_left_out_on_sqlite(tmp_path):
    engine = db.make_engine(sqlite_url(tmp_path / "empty.db"))
    statements = []
    event.listen(engine, "before_cursor_execute", lambda *args: statements.append(args[2]))
    db.migrate(engine)
    engine.dispose()
    assert statements
    assert not [s for s in statements if "ROW LEVEL SECURITY" in s]


def test_on_new_runs_for_a_new_database_and_not_on_the_next_start(tmp_path):
    engine = db.make_engine(sqlite_url(tmp_path / "empty.db"))
    seen = []

    def on_new(conn: sa.Connection) -> None:
        # Inside the migration's own transaction, with the tables already there.
        seen.append(conn.in_transaction())
        conn.execute(tables.users.insert().values(id="someone", email="someone@example.com"))

    assert db.migrate(engine, on_new=on_new) is True
    assert db.migrate(engine, on_new=on_new) is False
    with engine.connect() as conn:
        emails = conn.execute(sa.select(tables.users.c.email)).scalars().all()
    engine.dispose()
    assert seen == [True]
    assert emails == ["someone@example.com"]


def test_a_failure_in_on_new_leaves_the_database_new_to_try_again(tmp_path):
    engine = db.make_engine(sqlite_url(tmp_path / "empty.db"))

    def broken(_conn: sa.Connection) -> None:
        raise RuntimeError("the sample data couldn't be loaded")

    with pytest.raises(RuntimeError):
        db.migrate(engine, on_new=broken)
    names_after_the_failure = sa.inspect(engine).get_table_names()
    assert db.migrate(engine) is True
    engine.dispose()
    assert names_after_the_failure == []


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
