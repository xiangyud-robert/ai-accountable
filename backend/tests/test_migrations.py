import sqlalchemy as sa
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext

from backend import db, tables
from backend.tests.conftest import sqlite_url


def test_migrations_give_exactly_the_tables_in_tables_py(tmp_path):
    engine = db.make_engine(sqlite_url(tmp_path / "empty.db"))
    assert db.migrate(engine) is True
    with engine.connect() as conn:
        differences = compare_metadata(MigrationContext.configure(conn), tables.metadata)
        names = set(sa.inspect(conn).get_table_names())
    engine.dispose()
    assert differences == []
    assert names == set(tables.metadata.tables) | {"alembic_version"}


def test_foreign_keys_and_indexes_are_there(tmp_path):
    engine = db.make_engine(sqlite_url(tmp_path / "empty.db"))
    db.migrate(engine)
    inspector = sa.inspect(engine)
    activity_fks = {fk["referred_table"]: fk["options"].get("ondelete") for fk in inspector.get_foreign_keys("activities")}
    deal_fks = {fk["referred_table"]: fk["options"].get("ondelete") for fk in inspector.get_foreign_keys("deals")}
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
        differences = compare_metadata(MigrationContext.configure(conn), tables.metadata)
    engine.dispose()
    assert before == after is not None
    assert differences == []
