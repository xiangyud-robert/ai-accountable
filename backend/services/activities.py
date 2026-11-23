"""Activities: logging, changing and deleting them (R8), and marking follow-ups done (R9)."""

import sqlalchemy as sa

from backend import clock
from backend.errors import Invalid, NotFound
from backend.services import contacts as contacts_service
from backend.tables import activities, deals


def get(conn: sa.Connection, activity_id: int) -> dict:
    row = conn.execute(sa.select(activities).where(activities.c.id == activity_id)).first()
    if row is None:
        raise NotFound("activity")
    return dict(row._mapping)


def _check(activity: dict) -> None:
    if activity["occurred_at"] > clock.now():
        raise Invalid("occurred_at", "The time can't be later than now.")
    if activity["follow_up_done"] and activity["follow_up_date"] is None:
        raise Invalid("follow_up_done", "Add a follow-up date first.")


def add(conn: sa.Connection, data: dict) -> dict:
    """R8: logged on exactly one contact or one deal, at a time no later than now (now by default)."""
    activity = dict(data)
    contact_id, deal_id = activity.get("contact_id"), activity.get("deal_id")
    if (contact_id is None) == (deal_id is None):
        raise Invalid("contact_id", "Log the activity on one contact or one deal.")
    if contact_id is not None and not contacts_service.exists(conn, contact_id):
        raise Invalid("contact_id", "That contact no longer exists.")
    if deal_id is not None:
        found = conn.execute(sa.select(deals.c.id).where(deals.c.id == deal_id)).first()
        if found is None:
            raise Invalid("deal_id", "That deal no longer exists.")
    now = clock.now()
    if activity.get("occurred_at") is None:
        activity["occurred_at"] = now
    activity.setdefault("follow_up_date", None)
    activity.setdefault("follow_up_done", False)
    _check(activity)
    result = conn.execute(activities.insert().values(**activity, created_at=now, updated_at=now))
    return get(conn, result.inserted_primary_key[0])


def change(conn: sa.Connection, activity_id: int, data: dict) -> dict:
    """Changes the fields sent, including marking the follow-up done or not done."""
    current = get(conn, activity_id)
    data = dict(data)
    # Taking away the follow-up date takes away whether it was done.
    if "follow_up_date" in data and data["follow_up_date"] is None:
        data["follow_up_done"] = False
    _check({**current, **data})
    if data:
        conn.execute(
            activities.update()
            .where(activities.c.id == activity_id)
            .values(**data, updated_at=clock.now())
        )
    return get(conn, activity_id)


def delete(conn: sa.Connection, activity_id: int) -> None:
    get(conn, activity_id)
    conn.execute(activities.delete().where(activities.c.id == activity_id))
