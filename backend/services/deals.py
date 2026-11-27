"""Deals: listing, getting, adding, changing, moving and deleting.

change_stage() is the only place a deal's stage changes, so dragging, the keyboard, the
form and adding a deal all follow the same rules (R3, R4, R6). Positions in each stage's
column (R5) are kept numbered from 0 with no gaps.

`by` is the signed-in person's id, kept as who added and last changed it (R17). A change of
stage, however it's made, counts as a change. A card's place in its column doesn't.
"""

from datetime import date

import sqlalchemy as sa

from backend import clock, stages
from backend.errors import Invalid, NotFound
from backend.services import contacts as contacts_service
from backend.services import timeline
from backend.services.users import People
from backend.tables import activities, contacts, deals, organizations, stage_changes

PEOPLE = People(deals)
STAGE_ORDER = sa.case({s.key: s.order for s in stages.STAGES}, value=deals.c.stage)


def _query() -> sa.Select:
    activity_count = (
        sa.select(sa.func.count()).where(activities.c.deal_id == deals.c.id).scalar_subquery()
    )
    return (
        sa.select(
            deals,
            organizations.c.name.label("organization_name"),
            contacts.c.name.label("contact_name"),
            activity_count.label("activity_count"),
            *PEOPLE.columns(),
        )
        .select_from(
            PEOPLE.join(
                deals.outerjoin(
                    organizations, deals.c.organization_id == organizations.c.id
                ).outerjoin(contacts, deals.c.contact_id == contacts.c.id)
            )
        )
        .order_by(STAGE_ORDER, deals.c.position, deals.c.id)
    )


def expected(value: int, probability: int) -> float:
    """R2: value times probability."""
    return value * probability / 100


def is_late(stage: str, close_date: date, today: date) -> bool:
    """R1: an open deal whose close date is before today."""
    return stages.is_open(stage) and close_date < today


def _with_figures(row: sa.Row, today: date) -> dict:
    deal = PEOPLE.take(dict(row._mapping))
    deal["expected"] = expected(deal["value"], deal["probability"])
    deal["late"] = is_late(deal["stage"], deal["close_date"], today)
    return deal


def list_all(
    conn: sa.Connection,
    *,
    organization_id: int | None = None,
    contact_id: int | None = None,
) -> list[dict]:
    """All deals in stage and position order."""
    query = _query()
    if organization_id is not None:
        query = query.where(deals.c.organization_id == organization_id)
    if contact_id is not None:
        query = query.where(deals.c.contact_id == contact_id)
    today = clock.today()
    return [_with_figures(row, today) for row in conn.execute(query)]


def get_row(conn: sa.Connection, deal_id: int) -> dict:
    row = conn.execute(_query().where(deals.c.id == deal_id)).first()
    if row is None:
        raise NotFound("deal")
    return _with_figures(row, clock.today())


def get(conn: sa.Connection, deal_id: int) -> dict:
    result = get_row(conn, deal_id)
    result["timeline"] = timeline.for_deal(conn, deal_id)
    return result


def _current(conn: sa.Connection, deal_id: int) -> sa.Row:
    row = conn.execute(sa.select(deals).where(deals.c.id == deal_id)).first()
    if row is None:
        raise NotFound("deal")
    return row


def _check_links(conn: sa.Connection, data: dict) -> None:
    if "organization_id" in data:
        contacts_service.check_organization(conn, data["organization_id"])
    contact_id = data.get("contact_id")
    if contact_id is not None and not contacts_service.exists(conn, contact_id):
        raise Invalid("contact_id", "That contact no longer exists.")


def _check_probability(stage: str, probability: int | None) -> None:
    """R4: Won is always 100% and Lost always 0%."""
    if probability is None or stages.is_open(stage):
        return
    fixed = stages.usual_probability(stage)
    if probability != fixed:
        raise Invalid("probability", f"{stages.name(stage)} deals are always {fixed}%.")


def _column(conn: sa.Connection, stage: str, leaving_out: int) -> list[int]:
    query = (
        sa.select(deals.c.id)
        .where(deals.c.stage == stage, deals.c.id != leaving_out)
        .order_by(deals.c.position, deals.c.id)
    )
    return list(conn.scalars(query))


def _number(conn: sa.Connection, ids: list[int]) -> None:
    if ids:
        conn.execute(
            deals.update()
            .where(deals.c.id == sa.bindparam("deal_id"))
            .values(position=sa.bindparam("pos")),
            [{"deal_id": deal_id, "pos": pos} for pos, deal_id in enumerate(ids)],
        )


def _place(conn: sa.Connection, deal_id: int, stage: str, index: int) -> None:
    """Puts the deal at index in its stage's column, clamped to the column, and renumbers it."""
    ids = _column(conn, stage, leaving_out=deal_id)
    ids.insert(max(0, min(index, len(ids))), deal_id)
    _number(conn, ids)


def change_stage(
    conn: sa.Connection,
    deal_id: int,
    stage: str,
    *,
    probability: int | None = None,
    close_date: date | None = None,
    by: str,
    index: int = 0,
    added: bool = False,
) -> None:
    """Puts a deal in a new stage, following R3, R4 and R6.

    - records the stage change ("Added at ..." when added is True)
    - takes the stage's usual probability unless one is given
    - Won and Lost set today as the close date unless one is given
    - Won makes the main contact a customer
    - the deal goes to index in its new column, and its old column is renumbered (R5)
    """
    deal = _current(conn, deal_id)
    _check_probability(stage, probability)
    now = clock.now()
    values = {
        "stage": stage,
        "probability": probability if probability is not None else stages.usual_probability(stage),
        "updated_at": now,
        "updated_by": by,
    }
    if close_date is not None:
        values["close_date"] = close_date
    elif stage in stages.CLOSED_KEYS:
        values["close_date"] = clock.today()
    conn.execute(deals.update().where(deals.c.id == deal_id).values(**values))

    if not added:
        _number(conn, _column(conn, deal.stage, leaving_out=deal_id))
    _place(conn, deal_id, stage, index)

    conn.execute(
        stage_changes.insert().values(
            deal_id=deal_id,
            from_stage=None if added else deal.stage,
            to_stage=stage,
            changed_at=now,
        )
    )
    if stage == "won" and deal.contact_id is not None:
        contacts_service.set_status(
            conn, deal.contact_id, "customer", now=now, by=by, won_deal_id=deal_id
        )


def add(conn: sa.Connection, data: dict, *, by: str) -> dict:
    """R5 and R6: a new deal goes to the top of its column, and records its first stage."""
    data = dict(data)
    _check_links(conn, data)
    stage = data.pop("stage", "new")
    probability = data.pop("probability", None)
    close_date = data.pop("close_date", None)
    _check_probability(stage, probability)
    if close_date is None and stages.is_open(stage):
        raise Invalid("close_date", "Enter a close date.")
    now = clock.now()
    insert = deals.insert().values(
        **data,
        stage=stage,
        probability=stages.usual_probability(stage),
        close_date=close_date or clock.today(),
        position=0,
        created_at=now,
        updated_at=now,
        created_by=by,
        updated_by=by,
    )
    deal_id = conn.execute(insert.returning(deals.c.id)).scalar_one()
    change_stage(
        conn,
        deal_id,
        stage,
        probability=probability,
        close_date=close_date,
        by=by,
        index=0,
        added=True,
    )
    return get_row(conn, deal_id)


def change(conn: sa.Connection, deal_id: int, data: dict, *, by: str) -> dict:
    """R3 and R4. A new stage goes through change_stage(), at the top of its new column."""
    deal = _current(conn, deal_id)
    data = dict(data)
    _check_links(conn, data)
    stage = data.pop("stage", None)
    stage_changes_now = stage is not None and stage != deal.stage
    if stage_changes_now:
        probability = data.pop("probability", None)
        close_date = data.pop("close_date", None)
    else:
        _check_probability(deal.stage, data.get("probability"))
    if data:
        conn.execute(
            deals.update()
            .where(deals.c.id == deal_id)
            .values(**data, updated_at=clock.now(), updated_by=by)
        )
    if stage_changes_now:
        change_stage(
            conn, deal_id, stage, probability=probability, close_date=close_date, by=by, index=0
        )
    return get_row(conn, deal_id)


def move(conn: sa.Connection, deal_id: int, stage: str, index: int, *, by: str) -> dict:
    """A card dropped at index in a stage's column (R5). Within its own column only the place changes."""
    deal = _current(conn, deal_id)
    if stage == deal.stage:
        _place(conn, deal_id, stage, index)
    else:
        change_stage(conn, deal_id, stage, by=by, index=index)
    return get_row(conn, deal_id)


def delete(conn: sa.Connection, deal_id: int) -> None:
    """R11: its activities and stage changes go with it (the foreign keys do it)."""
    deal = _current(conn, deal_id)
    conn.execute(deals.delete().where(deals.c.id == deal_id))
    _number(conn, _column(conn, deal.stage, leaving_out=deal_id))
