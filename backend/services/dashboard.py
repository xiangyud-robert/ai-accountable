"""Every figure on the dashboard, worked out on the server from today's date.

"Won in a month" means a Won deal whose close date falls in that calendar month.
"""

from collections.abc import Sequence
from datetime import date, timedelta
from typing import TypedDict

import sqlalchemy as sa

from backend import clock, stages
from backend.services import timeline
from backend.services.users import People
from backend.tables import activities, contacts, deals, stage_changes

FOLLOW_UP_DAYS = 7
FUNNEL_KEYS = ("new", "qualified", "proposal", "negotiation", "won")
LOGGED_BY = People(activities, changed=False)


# The figures added up deal by deal, in the shapes of their models in schemas.py.
class _MonthFigures(TypedDict):
    month: str  # YYYY-MM
    revenue: int
    count: int


class _OpenFigures(TypedDict):
    count: int
    value: int
    expected: float


class _StageFigures(_OpenFigures):
    stage: str


class _FunnelStage(TypedDict):
    stage: str
    count: int
    value: int


def last_12_months(today: date) -> list[str]:
    """The last 12 calendar months as YYYY-MM, oldest first, this one included."""
    months = []
    year, month = today.year, today.month
    for _ in range(12):
        months.append(f"{year:04d}-{month:02d}")
        year, month = (year, month - 1) if month > 1 else (year - 1, 12)
    return months[::-1]


def _funnel(deal_rows: Sequence[sa.Row], history: Sequence[sa.Row]) -> list[_FunnelStage]:
    """Concern 7: each deal counts in every stage up to the furthest one it has reached.

    A won deal counts in every stage. A lost deal counts up to the furthest open stage in
    its history. An open deal counts up to the furthest of its history and its stage now.
    """
    order = {s.key: s.order for s in stages.STAGES}
    furthest: dict[int, int] = {}
    for row in history:
        if stages.is_open(row.to_stage):
            furthest[row.deal_id] = max(furthest.get(row.deal_id, 0), order[row.to_stage])
    funnel: dict[str, _FunnelStage] = {
        key: {"stage": key, "count": 0, "value": 0} for key in FUNNEL_KEYS
    }
    for deal in deal_rows:
        if deal.stage == "won":
            reached = order["won"]
        elif deal.stage == "lost":
            reached = furthest.get(deal.id, 0)
        else:
            reached = max(furthest.get(deal.id, 0), order[deal.stage])
        for key in FUNNEL_KEYS:
            if order[key] <= reached:
                funnel[key]["count"] += 1
                funnel[key]["value"] += deal.value
    return list(funnel.values())


def follow_ups(conn: sa.Connection, today: date) -> list[dict]:
    """R9: not done, and due no later than 7 days from today. Sorted by date, so overdue
    ones come first, oldest first, then the rest, soonest first. Each shows who logged it."""
    query = (
        sa.select(
            activities.c.id,
            activities.c.type,
            activities.c.description,
            activities.c.follow_up_date,
            activities.c.contact_id,
            activities.c.deal_id,
            activities.c.created_by,
            contacts.c.name.label("contact_name"),
            deals.c.name.label("deal_name"),
            *LOGGED_BY.columns(),
        )
        .select_from(
            LOGGED_BY.join(
                activities.outerjoin(contacts, activities.c.contact_id == contacts.c.id).outerjoin(
                    deals, activities.c.deal_id == deals.c.id
                )
            )
        )
        .where(
            activities.c.follow_up_done.is_(False),
            activities.c.follow_up_date.is_not(None),
            activities.c.follow_up_date <= today + timedelta(days=FOLLOW_UP_DAYS),
        )
        .order_by(activities.c.follow_up_date, activities.c.id)
    )
    result = []
    for row in conn.execute(query):
        days = (row.follow_up_date - today).days
        follow_up = LOGGED_BY.take(dict(row._mapping))
        result.append({**follow_up, "days": days, "overdue": days < 0})
    return result


def figures(conn: sa.Connection) -> dict:
    today = clock.today()
    deal_rows = conn.execute(
        sa.select(deals.c.id, deals.c.stage, deals.c.value, deals.c.probability, deals.c.close_date)
    ).all()
    history = conn.execute(sa.select(stage_changes.c.deal_id, stage_changes.c.to_stage)).all()

    months = last_12_months(today)
    won: dict[str, _MonthFigures] = {m: {"month": m, "revenue": 0, "count": 0} for m in months}
    previous = f"{(today.replace(day=1) - timedelta(days=1)):%Y-%m}"
    open_figures: _OpenFigures = {"count": 0, "value": 0, "expected": 0.0}
    by_stage: dict[str, _StageFigures] = {
        k: {"stage": k, "count": 0, "value": 0, "expected": 0.0} for k in stages.OPEN_KEYS
    }
    lost = {"count": 0, "value": 0}

    for deal in deal_rows:
        if deal.stage == "won":
            month = f"{deal.close_date:%Y-%m}"
            if month in won:
                won[month]["revenue"] += deal.value
                won[month]["count"] += 1
        elif deal.stage == "lost":
            lost["count"] += 1
            lost["value"] += deal.value
        else:
            expected = deal.value * deal.probability / 100
            for figures_ in (open_figures, by_stage[deal.stage]):
                figures_["count"] += 1
                figures_["value"] += deal.value
                figures_["expected"] += expected

    month_list = list(won.values())
    return {
        "today": today,
        "this_month": won[months[-1]],
        "last_month": won[previous],
        "months": month_list,
        "last_12_months": {
            "count": sum(m["count"] for m in month_list),
            "value": sum(m["revenue"] for m in month_list),
        },
        "open": open_figures,
        "by_stage": list(by_stage.values()),
        "funnel": _funnel(deal_rows, history),
        "lost": lost,
        "follow_ups": follow_ups(conn, today),
        "recent": timeline.recent(conn, 10),
    }
