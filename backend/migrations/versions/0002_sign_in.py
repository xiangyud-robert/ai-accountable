"""Signing in: the users table, who added and last changed each record (R17), and
row-level security on Postgres (concern 17).

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-26 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine import Dialect

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RECORD_TABLES = ("organizations", "contacts", "deals", "activities")
PEOPLE_COLUMNS = ("created_by", "updated_by")

# Every table there is once this migration has run. A later table turns row-level security
# on in the migration that adds it, since this list has to match the tables at this point.
ROW_LEVEL_SECURITY_TABLES = (
    "organizations",
    "contacts",
    "deals",
    "activities",
    "stage_changes",
    "status_changes",
    "users",
    "alembic_version",
)


def row_level_security(dialect: Dialect, enable: bool = True) -> list[str]:
    """SQLAlchemy has no construct for this, so it's the one statement sent as text, with
    each table's name quoted by the dialect."""
    action = "ENABLE" if enable else "DISABLE"
    quote = dialect.identifier_preparer.quote
    return [
        f"ALTER TABLE {quote(table)} {action} ROW LEVEL SECURITY"
        for table in ROW_LEVEL_SECURITY_TABLES
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    for table in RECORD_TABLES:
        with op.batch_alter_table(table, schema=None) as batch_op:
            for column in PEOPLE_COLUMNS:
                batch_op.add_column(sa.Column(column, sa.Text(), nullable=True))
                batch_op.create_index(batch_op.f(f"ix_{table}_{column}"), [column], unique=False)
                batch_op.create_foreign_key(
                    batch_op.f(f"fk_{table}_{column}_users"), "users", [column], ["id"]
                )
    # Supabase serves the public schema to anyone with the publishable key. With row-level
    # security on and no policies, it serves nothing. The backend connects as the owner,
    # which row-level security doesn't limit.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for statement in row_level_security(bind.dialect):
            op.execute(statement)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for statement in row_level_security(bind.dialect, enable=False):
            op.execute(statement)
    for table in reversed(RECORD_TABLES):
        with op.batch_alter_table(table, schema=None) as batch_op:
            for column in reversed(PEOPLE_COLUMNS):
                batch_op.drop_constraint(
                    batch_op.f(f"fk_{table}_{column}_users"), type_="foreignkey"
                )
                batch_op.drop_index(batch_op.f(f"ix_{table}_{column}"))
                batch_op.drop_column(column)
    op.drop_table("users")
