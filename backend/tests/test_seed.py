import itertools
from collections import Counter
from datetime import date, datetime, timedelta

import pytest
import sqlalchemy as sa

from backend import seed, stages
from backend.services import dashboard
from backend.tables import activities, organizations
from backend.tests.conftest import TODAY


@pytest.fixture(scope="module")
def rows():
    return seed.build(TODAY)


def test_the_counts_by_kind(rows):
    assert {name: len(table) for name, table in rows.items()} == {
        "organizations": 15,
        "contacts": 40,
        "deals": 45,
        "activities": 100,
        "stage_changes": sum(1 for _ in rows["stage_changes"]),
        "status_changes": 14,
    }


def test_the_counts_by_stage_and_status(rows):
    assert Counter(d["stage"] for d in rows["deals"]) == {
        "new": 5,
        "qualified": 5,
        "proposal": 5,
        "negotiation": 4,
        "won": 20,
        "lost": 6,
    }
    assert Counter(c["status"] for c in rows["contacts"]) == {
        "lead": 16,
        "qualified": 10,
        "customer": 14,
    }


def test_two_organizations_have_no_deals_and_two_contacts_no_organization(rows):
    with_deals = {d["organization_id"] for d in rows["deals"]}
    assert len([o for o in rows["organizations"] if o["id"] not in with_deals]) == 2
    assert len([c for c in rows["contacts"] if c["organization_id"] is None]) == 2


def test_values_are_in_range_and_in_steps_of_500(rows):
    for deal in rows["deals"]:
        assert 5_000 <= deal["value"] <= 150_000
        assert deal["value"] % 500 == 0


def test_three_open_deals_are_late(rows):
    late = [d for d in rows["deals"] if stages.is_open(d["stage"]) and d["close_date"] < TODAY]
    assert len(late) == 3


def test_open_deals_close_in_the_months_ahead_unless_late(rows):
    future = [d for d in rows["deals"] if stages.is_open(d["stage"]) and d["close_date"] >= TODAY]
    assert len(future) == 16


def test_the_follow_up_spread(rows):
    follow_ups = [a for a in rows["activities"] if a["follow_up_date"] is not None]
    week = TODAY + timedelta(days=7)
    spread = Counter(
        "done"
        if a["follow_up_done"]
        else "overdue"
        if a["follow_up_date"] < TODAY
        else "soon"
        if a["follow_up_date"] <= week
        else "later"
        for a in follow_ups
    )
    assert spread == {"overdue": 5, "soon": 6, "later": 3, "done": 6}


def test_activities_are_over_the_past_12_months_and_more_of_them_recent(rows):
    now = datetime.combine(TODAY, datetime.min.time()) + timedelta(hours=12)
    ages = [(now - a["occurred_at"]).days for a in rows["activities"]]
    assert all(0 <= age <= 365 for age in ages)
    assert sum(age <= 90 for age in ages) > sum(age > 270 for age in ages) * 2
    assert {a["type"] for a in rows["activities"]} == {"note", "call", "email"}
    on_deals = sum(a["deal_id"] is not None for a in rows["activities"])
    assert 30 <= on_deals <= 70


def test_every_activity_belongs_to_exactly_one_record(rows):
    for activity in rows["activities"]:
        assert (activity["contact_id"] is None) != (activity["deal_id"] is None)


def test_activities_on_a_deal_come_after_it_was_added(rows):
    added = {d["id"]: d["created_at"] for d in rows["deals"]}
    for activity in rows["activities"]:
        if activity["deal_id"] is not None:
            assert activity["occurred_at"] >= added[activity["deal_id"]]


def test_wins_in_at_least_10_of_the_last_12_months(rows):
    months = set(dashboard.last_12_months(TODAY))
    won = {f"{d['close_date']:%Y-%m}" for d in rows["deals"] if d["stage"] == "won"}
    assert len(months & won) >= 10


def test_wins_cover_10_months_whatever_the_date():
    for offset in range(0, 366, 7):
        today = date(2026, 1, 1) + timedelta(days=offset)
        months = set(dashboard.last_12_months(today))
        won = {
            f"{d['close_date']:%Y-%m}" for d in seed.build(today)["deals"] if d["stage"] == "won"
        }
        assert len(months & won) >= 10, today


def test_losses_from_at_least_three_stages(rows):
    lost_ids = {d["id"] for d in rows["deals"] if d["stage"] == "lost"}
    lost_from = {
        c["from_stage"]
        for c in rows["stage_changes"]
        if c["deal_id"] in lost_ids and c["to_stage"] == "lost"
    }
    assert len(lost_from) >= 3


def test_every_main_contact_of_a_won_deal_is_a_customer(rows):
    status = {c["id"]: c["status"] for c in rows["contacts"]}
    for deal in rows["deals"]:
        if deal["stage"] == "won":
            assert status[deal["contact_id"]] == "customer"


def test_each_customer_became_one_on_their_first_win(rows):
    won_at = {
        c["deal_id"]: c["changed_at"] for c in rows["stage_changes"] if c["to_stage"] == "won"
    }
    customers = {c["id"] for c in rows["contacts"] if c["status"] == "customer"}
    assert {s["contact_id"] for s in rows["status_changes"]} == customers
    for change in rows["status_changes"]:
        wins = [
            d["id"]
            for d in rows["deals"]
            if d["contact_id"] == change["contact_id"] and d["stage"] == "won"
        ]
        assert change["won_deal_id"] == min(wins, key=lambda deal_id: won_at[deal_id])
        assert change["changed_at"] == won_at[change["won_deal_id"]]


def test_stage_histories_fit_each_deal(rows):
    now = datetime.combine(TODAY, datetime.min.time()) + timedelta(hours=12)
    for deal in rows["deals"]:
        history = [c for c in rows["stage_changes"] if c["deal_id"] == deal["id"]]
        assert history[0]["from_stage"] is None
        assert history[-1]["to_stage"] == deal["stage"]
        for before, after in itertools.pairwise(history):
            assert after["from_stage"] == before["to_stage"]
            assert after["changed_at"] > before["changed_at"]
        assert history[-1]["changed_at"] <= now
        if not stages.is_open(deal["stage"]):
            assert history[-1]["changed_at"].date() == deal["close_date"]


def test_positions_number_each_column_from_0(rows):
    for stage in stages.KEYS:
        positions = [d["position"] for d in rows["deals"] if d["stage"] == stage]
        assert positions == list(range(len(positions)))


def test_two_loads_with_the_same_today_give_the_same_rows(rows):
    assert seed.build(TODAY) == rows


def test_a_later_today_moves_every_date_by_the_same_number_of_days(rows):
    later = seed.build(TODAY + timedelta(days=40))
    shift = timedelta(days=40)
    for name, table in rows.items():
        for before, after in zip(table, later[name]):
            for key, value in before.items():
                if isinstance(value, (date, datetime)):
                    assert after[key] == value + shift, (name, key)
                else:
                    assert after[key] == value, (name, key)


def test_loading_clears_the_data_that_was_there(make, conn):
    make.org(name="Made before the reset")
    counts = seed.load(conn, TODAY)
    names = conn.execute(sa.select(organizations.c.name)).scalars().all()
    assert "Made before the reset" not in names
    assert len(names) == counts["organizations"] == 15
    assert conn.execute(sa.select(sa.func.count()).select_from(activities)).scalar() == 100


def test_this_morning_is_never_later_than_now(monkeypatch, conn):
    monkeypatch.setenv("ACCOUNTABLE_TODAY", "")
    from backend import clock

    seed.load(conn, clock.today())
    latest = conn.execute(sa.select(sa.func.max(activities.c.occurred_at))).scalar()
    assert latest <= clock.now()


def test_large_adds_500_of_each_kind():
    counts = {name: len(table) for name, table in seed.build(TODAY, large=True).items()}
    assert (counts["organizations"], counts["contacts"], counts["deals"], counts["activities"]) == (
        515,
        540,
        545,
        600,
    )


def test_names_are_unique(rows):
    for table in ("organizations", "contacts", "deals"):
        names = [r["name"] for r in rows[table]]
        assert len(names) == len(set(names)), table
