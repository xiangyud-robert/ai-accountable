from datetime import timedelta

from backend.services import activities, dashboard
from backend.tests.conftest import DANA, TODAY


def due(make, contact, days, **fields):
    return make.activity(
        contact_id=contact["id"],
        description=f"Due {days:+d}",
        follow_up_date=TODAY + timedelta(days=days),
        **fields,
    )


def listed(conn):
    return [(f["description"], f["days"], f["overdue"]) for f in dashboard.follow_ups(conn, TODAY)]


def test_r9_overdue_the_day_before_today_and_not_on_today(make, conn):
    contact = make.contact()
    due(make, contact, -1)
    due(make, contact, 0)
    assert listed(conn) == [("Due -1", -1, True), ("Due +0", 0, False)]


def test_r9_due_up_to_7_days_ahead_and_not_8(make, conn):
    contact = make.contact()
    due(make, contact, 7)
    due(make, contact, 8)
    assert listed(conn) == [("Due +7", 7, False)]


def test_r9_done_follow_ups_are_left_out(make, conn):
    contact = make.contact()
    done = due(make, contact, -3)
    due(make, contact, 2)
    activities.change(conn, done["id"], {"follow_up_done": True}, by=DANA.id)
    assert listed(conn) == [("Due +2", 2, False)]


def test_r9_activities_with_no_follow_up_are_left_out(make, conn):
    contact = make.contact()
    make.activity(contact_id=contact["id"])
    assert listed(conn) == []


def test_r9_overdue_oldest_first_then_the_rest_soonest_first(make, conn):
    contact = make.contact()
    for days in (3, -2, 0, -9, 6, -1):
        due(make, contact, days)
    assert [d for _, d, _ in listed(conn)] == [-9, -2, -1, 0, 3, 6]


def test_r9_a_follow_up_on_a_deal_names_the_deal(make, conn):
    deal = make.deal(name="Brightline Retail POS integration")
    make.activity(deal_id=deal["id"], follow_up_date=TODAY)
    [item] = dashboard.follow_ups(conn, TODAY)
    assert (item["deal_id"], item["deal_name"], item["contact_id"]) == (
        deal["id"],
        "Brightline Retail POS integration",
        None,
    )
