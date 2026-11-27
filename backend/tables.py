"""The seven tables, in SQLAlchemy Core. Alembic's migrations are checked against these."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    false,
)

# Named constraints, so batch migrations on SQLite can find them later.
metadata = MetaData(
    naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    }
)


# Everyone who has used the app, and the sample data's made-up teammates. The id is the
# person's Supabase user id, and people are never deleted by the app (concern 19).
users = Table(
    "users",
    metadata,
    Column("id", Text, primary_key=True),
    Column("email", String(254), nullable=False),
    Column("display_name", String(120)),
)


def _added_and_changed() -> list[Column]:
    """When the record was added and last changed, and by whom (R17). The people are empty
    for a record from before sign-in."""
    return [
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        Column("created_by", Text, ForeignKey("users.id"), index=True),
        Column("updated_by", Text, ForeignKey("users.id"), index=True),
    ]


organizations = Table(
    "organizations",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(120), nullable=False),
    Column("website", String(300)),
    Column("industry", String(80)),
    Column("notes", Text),
    *_added_and_changed(),
)

contacts = Table(
    "contacts",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(120), nullable=False),
    Column("email", String(254)),
    Column("phone", String(40)),
    Column("job_title", String(120)),
    Column(
        "organization_id",
        Integer,
        ForeignKey("organizations.id", ondelete="SET NULL"),
        index=True,
    ),
    Column("status", String(20), nullable=False, server_default="lead"),
    *_added_and_changed(),
)

deals = Table(
    "deals",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(160), nullable=False),
    Column(
        "organization_id",
        Integer,
        ForeignKey("organizations.id", ondelete="SET NULL"),
        index=True,
    ),
    Column("contact_id", Integer, ForeignKey("contacts.id", ondelete="SET NULL"), index=True),
    Column("stage", String(20), nullable=False),
    Column("value", Integer, nullable=False),
    Column("probability", Integer, nullable=False),
    Column("close_date", Date, nullable=False),
    Column("position", Integer, nullable=False, server_default="0"),
    *_added_and_changed(),
    Index("ix_deals_stage_position", "stage", "position"),
)

activities = Table(
    "activities",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("type", String(10), nullable=False),
    Column("contact_id", Integer, ForeignKey("contacts.id", ondelete="CASCADE"), index=True),
    Column("deal_id", Integer, ForeignKey("deals.id", ondelete="CASCADE"), index=True),
    Column("description", Text, nullable=False),
    Column("occurred_at", DateTime, nullable=False),
    Column("follow_up_date", Date, index=True),
    Column("follow_up_done", Boolean, nullable=False, server_default=false()),
    *_added_and_changed(),
    # An activity belongs to exactly one contact or one deal (R8).
    CheckConstraint("(contact_id IS NULL) <> (deal_id IS NULL)", name="one_record"),
)

stage_changes = Table(
    "stage_changes",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "deal_id",
        Integer,
        ForeignKey("deals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("from_stage", String(20)),
    Column("to_stage", String(20), nullable=False),
    Column("changed_at", DateTime, nullable=False),
)

status_changes = Table(
    "status_changes",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "contact_id",
        Integer,
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("from_status", String(20), nullable=False),
    Column("to_status", String(20), nullable=False),
    Column("won_deal_id", Integer, ForeignKey("deals.id", ondelete="SET NULL"), index=True),
    Column("changed_at", DateTime, nullable=False),
)
