"""Contacts: listing, getting, adding, changing and deleting. Every status change is recorded (R7).

`by` is the signed-in person's id, kept as who added and last changed it (R17).
"""

from datetime import datetime

import sqlalchemy as sa

from backend import clock
from backend.errors import Invalid, NotFound
from backend.services import deals as deals_service
from backend.services import timeline
from backend.services.users import People
from backend.tables import activities, contacts, deals, organizations, status_changes

PEOPLE = People(contacts)


def _query() -> sa.Select:
    deal_count = (
        sa.select(sa.func.count()).where(deals.c.contact_id == contacts.c.id).scalar_subquery()
    )
    activity_count = (
        sa.select(sa.func.count()).where(activities.c.contact_id == contacts.c.id).scalar_subquery()
    )
    return sa.select(
        contacts,
        organizations.c.name.label("organization_name"),
        deal_count.label("deal_count"),
        activity_count.label("activity_count"),
        *PEOPLE.columns(),
    ).select_from(
        PEOPLE.join(
            contacts.outerjoin(organizations, contacts.c.organization_id == organizations.c.id)
        )
    )


def list_all(conn: sa.Connection, *, organization_id: int | None = None) -> list[dict]:
    query = _query().order_by(sa.func.lower(contacts.c.name), contacts.c.id)
    if organization_id is not None:
        query = query.where(contacts.c.organization_id == organization_id)
    return [PEOPLE.take(dict(row._mapping)) for row in conn.execute(query)]


def get_row(conn: sa.Connection, contact_id: int) -> dict:
    row = conn.execute(_query().where(contacts.c.id == contact_id)).first()
    if row is None:
        raise NotFound("contact")
    return PEOPLE.take(dict(row._mapping))


def get(conn: sa.Connection, contact_id: int) -> dict:
    result = get_row(conn, contact_id)
    result["organization"] = (
        {"id": result["organization_id"], "name": result["organization_name"]}
        if result["organization_id"] is not None
        else None
    )
    result["deals"] = deals_service.list_all(conn, contact_id=contact_id)
    result["timeline"] = timeline.for_contact(conn, contact_id)
    return result


def exists(conn: sa.Connection, contact_id: int) -> bool:
    return (
        conn.execute(sa.select(contacts.c.id).where(contacts.c.id == contact_id)).first()
        is not None
    )


def check_organization(conn: sa.Connection, organization_id: int | None) -> None:
    if organization_id is None:
        return
    query = sa.select(organizations.c.id).where(organizations.c.id == organization_id)
    if conn.execute(query).first() is None:
        raise Invalid("organization_id", "That organization no longer exists.")


def add(conn: sa.Connection, data: dict, *, by: str) -> dict:
    """A new contact starts as a lead unless another status is given. Adding isn't a change."""
    check_organization(conn, data.get("organization_id"))
    now = clock.now()
    insert = contacts.insert().values(
        **data, created_at=now, updated_at=now, created_by=by, updated_by=by
    )
    return get_row(conn, conn.execute(insert.returning(contacts.c.id)).scalar_one())


def change(conn: sa.Connection, contact_id: int, data: dict, *, by: str) -> dict:
    get_row(conn, contact_id)
    data = dict(data)
    if "organization_id" in data:
        check_organization(conn, data["organization_id"])
    status = data.pop("status", None)
    now = clock.now()
    if data:
        conn.execute(
            contacts.update()
            .where(contacts.c.id == contact_id)
            .values(**data, updated_at=now, updated_by=by)
        )
    if status is not None:
        set_status(conn, contact_id, status, now=now, by=by)
    return get_row(conn, contact_id)


def set_status(
    conn: sa.Connection,
    contact_id: int,
    status: str,
    *,
    now: datetime,
    by: str,
    won_deal_id: int | None = None,
) -> bool:
    """Changes a contact's status and records the change (R7), as changed by `by`, who for a
    won deal is whoever moved it (R17). Returns False if it was already that."""
    current = conn.execute(
        sa.select(contacts.c.status).where(contacts.c.id == contact_id)
    ).scalar_one()
    if current == status:
        return False
    conn.execute(
        contacts.update()
        .where(contacts.c.id == contact_id)
        .values(status=status, updated_at=now, updated_by=by)
    )
    conn.execute(
        status_changes.insert().values(
            contact_id=contact_id,
            from_status=current,
            to_status=status,
            won_deal_id=won_deal_id,
            changed_at=now,
        )
    )
    return True


def delete(conn: sa.Connection, contact_id: int) -> None:
    """R11: their deals are kept with no main contact. Their activities and status changes go."""
    get_row(conn, contact_id)
    conn.execute(contacts.delete().where(contacts.c.id == contact_id))
