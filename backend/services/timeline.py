"""Timelines (R10) and the dashboard's recent activity.

A timeline mixes three kinds of entry: activities, stage changes and status changes. Each
is newest first. Entries at the same moment put a status change above the stage change
that caused it, then break ties by id.
"""

import sqlalchemy as sa

from backend import clock, stages
from backend.tables import activities, contacts, deals, stage_changes, status_changes

KIND_RANK = {"status_change": 2, "stage_change": 1, "activity": 0}
STATUS_NAMES = {"lead": "Lead", "qualified": "Qualified", "customer": "Customer"}

deal_contacts = contacts.alias("deal_contacts")


def _activities() -> sa.Select:
    return sa.select(
        activities,
        sa.func.coalesce(contacts.c.name, deal_contacts.c.name).label("contact_name"),
        sa.func.coalesce(activities.c.contact_id, deals.c.contact_id).label("linked_contact_id"),
        deals.c.name.label("deal_name"),
    ).select_from(
        activities.outerjoin(contacts, activities.c.contact_id == contacts.c.id)
        .outerjoin(deals, activities.c.deal_id == deals.c.id)
        .outerjoin(deal_contacts, deals.c.contact_id == deal_contacts.c.id)
    )


def _stage_changes() -> sa.Select:
    return sa.select(
        stage_changes,
        deals.c.name.label("deal_name"),
        deals.c.contact_id,
        contacts.c.name.label("contact_name"),
    ).select_from(
        stage_changes.join(deals, stage_changes.c.deal_id == deals.c.id).outerjoin(
            contacts, deals.c.contact_id == contacts.c.id
        )
    )


def _status_changes() -> sa.Select:
    return sa.select(
        status_changes,
        contacts.c.name.label("contact_name"),
        deals.c.name.label("deal_name"),
    ).select_from(
        status_changes.join(contacts, status_changes.c.contact_id == contacts.c.id).outerjoin(
            deals, status_changes.c.won_deal_id == deals.c.id
        )
    )


def _activity_entry(row: sa.Row) -> dict:
    return {
        "key": f"activity-{row.id}",
        "kind": "activity",
        "id": row.id,
        "at": row.occurred_at,
        "text": row.description,
        "record": "contact" if row.contact_id is not None else "deal",
        "type": row.type,
        "follow_up_date": row.follow_up_date,
        "follow_up_done": row.follow_up_done,
        # R9: the backend decides what's overdue, as it does for the dashboard.
        "follow_up_overdue": row.follow_up_date is not None
        and not row.follow_up_done
        and row.follow_up_date < clock.today(),
        "contact_id": row.linked_contact_id,
        "contact_name": row.contact_name,
        "deal_id": row.deal_id,
        "deal_name": row.deal_name,
    }


def stage_text(from_stage: str | None, to_stage: str) -> str:
    if from_stage is None:
        return f"Added at {stages.name(to_stage)}"
    return f"Moved from {stages.name(from_stage)} to {stages.name(to_stage)}"


def _stage_entry(row: sa.Row) -> dict:
    return {
        "key": f"stage-{row.id}",
        "kind": "stage_change",
        "id": row.id,
        "at": row.changed_at,
        "text": stage_text(row.from_stage, row.to_stage),
        "record": "deal",
        "from_value": row.from_stage,
        "to_value": row.to_stage,
        "contact_id": row.contact_id,
        "contact_name": row.contact_name,
        "deal_id": row.deal_id,
        "deal_name": row.deal_name,
    }


def status_text(from_status: str, to_status: str, won_deal_name: str | None) -> str:
    if to_status == "customer" and won_deal_name is not None:
        return f"Became a customer when {won_deal_name} was won"
    return f"Status changed from {STATUS_NAMES[from_status]} to {STATUS_NAMES[to_status]}"


def _status_entry(row: sa.Row) -> dict:
    return {
        "key": f"status-{row.id}",
        "kind": "status_change",
        "id": row.id,
        "at": row.changed_at,
        "text": status_text(row.from_status, row.to_status, row.deal_name),
        "record": "contact",
        "from_value": row.from_status,
        "to_value": row.to_status,
        "contact_id": row.contact_id,
        "contact_name": row.contact_name,
        "deal_id": row.won_deal_id,
        "deal_name": row.deal_name,
    }


def _newest_first(entries: list[dict]) -> list[dict]:
    return sorted(entries, key=lambda e: (e["at"], KIND_RANK[e["kind"]], e["id"]), reverse=True)


def for_deal(conn: sa.Connection, deal_id: int) -> list[dict]:
    """R10: the deal's activities and stage changes."""
    entries = [
        _activity_entry(r)
        for r in conn.execute(_activities().where(activities.c.deal_id == deal_id))
    ]
    entries += [
        _stage_entry(r)
        for r in conn.execute(_stage_changes().where(stage_changes.c.deal_id == deal_id))
    ]
    return _newest_first(entries)


def for_contact(conn: sa.Connection, contact_id: int) -> list[dict]:
    """R10: their own activities, the activities and stage changes of deals where they're the
    main contact now (concern 10), and their status changes."""
    their_deals = sa.select(deals.c.id).where(deals.c.contact_id == contact_id)
    entries = [
        _activity_entry(r)
        for r in conn.execute(
            _activities().where(
                sa.or_(activities.c.contact_id == contact_id, activities.c.deal_id.in_(their_deals))
            )
        )
    ]
    entries += [
        _stage_entry(r)
        for r in conn.execute(_stage_changes().where(stage_changes.c.deal_id.in_(their_deals)))
    ]
    entries += [
        _status_entry(r)
        for r in conn.execute(_status_changes().where(status_changes.c.contact_id == contact_id))
    ]
    return _newest_first(entries)


def recent(conn: sa.Connection, limit: int = 10) -> list[dict]:
    """The newest entries of all three kinds, from anywhere."""
    entries = [
        _activity_entry(r)
        for r in conn.execute(
            _activities()
            .order_by(activities.c.occurred_at.desc(), activities.c.id.desc())
            .limit(limit)
        )
    ]
    entries += [
        _stage_entry(r)
        for r in conn.execute(
            _stage_changes()
            .order_by(stage_changes.c.changed_at.desc(), stage_changes.c.id.desc())
            .limit(limit)
        )
    ]
    entries += [
        _status_entry(r)
        for r in conn.execute(
            _status_changes()
            .order_by(status_changes.c.changed_at.desc(), status_changes.c.id.desc())
            .limit(limit)
        )
    ]
    return _newest_first(entries)[:limit]
