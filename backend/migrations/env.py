"""Alembic's environment. The URL comes from settings, and the target is tables.metadata."""

from logging.config import fileConfig

from alembic import context

from backend import db, tables

config = context.config

# Only the command line has an ini file with logging settings. The app has none.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=tables.metadata,
        # SQLite can't alter most columns in place, so batch mode rebuilds the table instead.
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # db.migrate() passes in its own connection. The command line makes one from settings.
    connection = config.attributes.get("connection")
    if connection is not None:
        run_migrations(connection)
        return
    engine = db.make_engine()
    with engine.connect() as connection:
        run_migrations(connection)
    engine.dispose()


if context.is_offline_mode():
    raise SystemExit("Offline migrations aren't used here. Run them against a database.")
run_migrations_online()
