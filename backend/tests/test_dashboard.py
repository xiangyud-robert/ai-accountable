from datetime import date, timedelta

from backend.services import dashboard, deals
from backend.tests.conftest import NOW, TODAY


def won(make, value, close_date, **fields):
    return make.deal(stage="won", value=value, close_date=close_date, **fields)


def test_revenue_and_deals_won_this_month_and_last_month(make, conn):
    won(make, 10_000, date(2026, 6, 1))
    won(make, 5_000, TODAY)
    won(make, 7_500, date(2026, 5, 31))
    won(make, 99_000, date(2025, 6, 15))  # a year ago, outside the 12 months
    make.deal(stage="lost", value=50_000, close_date=TODAY)
    figures = dashboard.figures(conn)
    assert figures["this_month"] == {"month": "2026-06", "revenue": 15_000, "count": 2}
    assert figures["last_month"] == {"month": "2026-05", "revenue": 7_500, "count": 1}
    assert figures["last_12_months"] == {"count": 3, "value": 22_500}


def test_the_12_months_include_this_one_with_zeros(make, conn):
    won(make, 2_000, date(2025, 7, 1))
    figures = dashboard.figures(conn)
    months = figures["months"]
    assert [m["month"] for m in months] == [
        "2025-07",
        "2025-08",
        "2025-09",
        "2025-10",
        "2025-11",
        "2025-12",
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
        "2026-05",
        "2026-06",
    ]
    assert months[0] == {"month": "2025-07", "revenue": 2_000, "count": 1}
    assert all(m["revenue"] == 0 and m["count"] == 0 for m in months[1:])


def test_last_month_in_january_is_december(monkeypatch, make, conn):
    monkeypatch.setenv("ACCOUNTABLE_TODAY", "2026-01-10")
    won(make, 3_000, date(2025, 12, 24))
    figures = dashboard.figures(conn)
    assert figures["last_month"] == {"month": "2025-12", "revenue": 3_000, "count": 1}
    assert figures["months"][-1]["month"] == "2026-01"


def test_the_open_pipeline_and_each_open_stage(make, conn):
    make.deal(stage="new", value=10_000)
    make.deal(stage="new", value=30_000, probability=20)
    make.deal(stage="proposal", value=40_000)
    make.deal(stage="negotiation", value=8_000)
    won(make, 100_000, TODAY)
    make.deal(stage="lost", value=60_000, close_date=TODAY)
    figures = dashboard.figures(conn)
    assert figures["open"] == {
        "count": 4,
        "value": 88_000,
        "expected": 1_000 + 6_000 + 20_000 + 6_000,
    }
    assert figures["by_stage"] == [
        {"stage": "new", "count": 2, "value": 40_000, "expected": 7_000},
        {"stage": "qualified", "count": 0, "value": 0, "expected": 0},
        {"stage": "proposal", "count": 1, "value": 40_000, "expected": 20_000},
        {"stage": "negotiation", "count": 1, "value": 8_000, "expected": 6_000},
    ]


def test_the_funnel(make, conn):
    """Concern 7."""
    skipped = make.deal(name="Skipped Qualified", stage="new", value=1_000)
    deals.move(conn, skipped["id"], "proposal", 0)
    lost = make.deal(name="Lost from Qualified", stage="new", value=2_000)
    deals.move(conn, lost["id"], "qualified", 0)
    deals.move(conn, lost["id"], "lost", 0)
    won(make, 4_000, TODAY)
    make.deal(name="Added at Lost", stage="lost", value=8_000, close_date=None)
    figures = dashboard.figures(conn)
    assert figures["funnel"] == [
        {"stage": "new", "count": 3, "value": 7_000},
        {"stage": "qualified", "count": 3, "value": 7_000},
        {"stage": "proposal", "count": 2, "value": 5_000},
        {"stage": "negotiation", "count": 1, "value": 4_000},
        {"stage": "won", "count": 1, "value": 4_000},
    ]
    assert figures["lost"] == {"count": 2, "value": 10_000}


def test_recent_activity_is_the_10_newest_of_all_three_kinds(make, conn):
    contact = make.contact()
    for n in range(12):
        make.activity(
            contact_id=contact["id"],
            description=f"Note {n}",
            occurred_at=NOW - timedelta(days=n + 1),
        )
    deal = make.deal(contact_id=contact["id"], stage="negotiation")
    deals.move(conn, deal["id"], "won", 0)
    recent = dashboard.figures(conn)["recent"]
    assert [e["text"] for e in recent] == [
        "Became a customer when Harbor Logistics fleet analytics was won",
        "Moved from Negotiation to Won",
        "Added at Negotiation",
    ] + [f"Note {n}" for n in range(7)]
