"""Organizations: listing with counts, getting, adding, changing and deleting."""

import sqlalchemy as sa

from backend import clock, stages
from backend.errors import NotFound
from backend.services import contacts as contacts_service
from backend.services import deals as deals_service
from backend.tables import contacts, deals, organizations


def _query() -> sa.Select:
    linked = deals.c.organization_id == organizations.c.id
    is_open = deals.c.stage.in_(stages.OPEN_KEYS)
    contact_count = (
        sa.select(sa.func.count())
        .where(contacts.c.organization_id == organizations.c.id)
        .scalar_subquery()
    )
    deal_count = sa.select(sa.func.count()).where(linked).scalar_subquery()
    open_deal_count = sa.select(sa.func.count()).where(linked, is_open).scalar_subquery()
    open_value = (
        sa.select(sa.func.coalesce(sa.func.sum(deals.c.value), 0))
        .where(linked, is_open)
        .scalar_subquery()
    )
    return sa.select(
        organizations,
        contact_count.label("contact_count"),
        deal_count.label("deal_count"),
        open_deal_count.label("open_deal_count"),
        open_value.label("open_value"),
    )


def list_all(conn: sa.Connection) -> list[dict]:
    rows = conn.execute(_query().order_by(sa.func.lower(organizations.c.name), organizations.c.id))
    return [dict(row._mapping) for row in rows]


def get_row(conn: sa.Connection, organization_id: int) -> dict:
    row = conn.execute(_query().where(organizations.c.id == organization_id)).first()
    if row is None:
        raise NotFound("organization")
    return dict(row._mapping)


def get(conn: sa.Connection, organization_id: int) -> dict:
    result = get_row(conn, organization_id)
    result["contacts"] = contacts_service.list_all(conn, organization_id=organization_id)
    result["deals"] = deals_service.list_all(conn, organization_id=organization_id)
    result["won_value"] = sum(d["value"] for d in result["deals"] if d["stage"] == "won")
    return result


def exists(conn: sa.Connection, organization_id: int) -> bool:
    query = sa.select(organizations.c.id).where(organizations.c.id == organization_id)
    return conn.execute(query).first() is not None


def add(conn: sa.Connection, data: dict) -> dict:
    now = clock.now()
    insert = organizations.insert().values(**data, created_at=now, updated_at=now)
    return get_row(conn, conn.execute(insert.returning(organizations.c.id)).scalar_one())


def change(conn: sa.Connection, organization_id: int, data: dict) -> dict:
    get_row(conn, organization_id)
    if data:
        conn.execute(
            organizations.update()
            .where(organizations.c.id == organization_id)
            .values(**data, updated_at=clock.now())
        )
    return get_row(conn, organization_id)


def delete(conn: sa.Connection, organization_id: int) -> None:
    """R11: its contacts and deals are kept, with no organization (the foreign keys do it)."""
    get_row(conn, organization_id)
    conn.execute(organizations.delete().where(organizations.c.id == organization_id))
