from datetime import date

import pytest
import sqlalchemy as sa

from backend.errors import Invalid
from backend.services import contacts, deals
from backend.tables import stage_changes, status_changes
from backend.tests.conftest import DANA, NOW, TODAY


def history(conn, deal_id):
    query = (
        sa.select(stage_changes.c.from_stage, stage_changes.c.to_stage)
        .where(stage_changes.c.deal_id == deal_id)
        .order_by(stage_changes.c.id)
    )
    return [tuple(r) for r in conn.execute(query)]


def status_history(conn, contact_id):
    query = (
        sa.select(
            status_changes.c.from_status, status_changes.c.to_status, status_changes.c.won_deal_id
        )
        .where(status_changes.c.contact_id == contact_id)
        .order_by(status_changes.c.id)
    )
    return [tuple(r) for r in conn.execute(query)]


def column(conn, stage):
    return [(d["name"], d["position"]) for d in deals.list_all(conn) if d["stage"] == stage]


# R1


@pytest.mark.parametrize(
    ("stage", "close_date", "late"),
    [
        ("proposal", date(2026, 6, 14), True),
        ("proposal", TODAY, False),
        ("proposal", date(2026, 6, 16), False),
        ("new", date(2026, 1, 1), True),
        ("won", date(2026, 1, 1), False),
        ("lost", date(2026, 1, 1), False),
    ],
)
def test_r1_late_only_for_open_deals_with_a_close_date_before_today(make, stage, close_date, late):
    assert make.deal(stage=stage, close_date=close_date)["late"] is late


# R2


def test_r2_expected_revenue_is_value_times_probability(make):
    assert make.deal(value=20_000, probability=30)["expected"] == 6_000


def test_r2_totals_count_open_deals_only(make, conn):
    from backend.services import organizations

    org = make.org()
    make.deal(organization_id=org["id"], stage="new", value=10_000)
    make.deal(organization_id=org["id"], stage="proposal", value=20_000)
    make.deal(organization_id=org["id"], stage="won", value=40_000)
    make.deal(organization_id=org["id"], stage="lost", value=80_000)
    row = organizations.get_row(conn, org["id"])
    assert (row["open_deal_count"], row["open_value"]) == (2, 30_000)


# R3


def test_r3_records_a_stage_change_from_and_to_the_right_stages(make, conn):
    deal = make.deal(stage="proposal")
    deals.move(conn, deal["id"], "negotiation", 0, by=DANA.id)
    assert history(conn, deal["id"]) == [(None, "proposal"), ("proposal", "negotiation")]


def test_r3_takes_the_usual_probability(make, conn):
    deal = make.deal(stage="new", probability=40)
    assert deals.move(conn, deal["id"], "proposal", 0, by=DANA.id)["probability"] == 50


def test_r3_keeps_a_probability_set_in_the_same_save(make, conn):
    deal = make.deal(stage="new")
    assert (
        deals.change(conn, deal["id"], {"stage": "proposal", "probability": 65}, by=DANA.id)[
            "probability"
        ]
        == 65
    )


def test_r3_won_and_lost_set_today_as_the_close_date(make, conn):
    won = make.deal(stage="negotiation", close_date=date(2026, 9, 1))
    lost = make.deal(stage="qualified", close_date=date(2026, 9, 1))
    assert deals.move(conn, won["id"], "won", 0, by=DANA.id)["close_date"] == TODAY
    assert deals.move(conn, lost["id"], "lost", 0, by=DANA.id)["close_date"] == TODAY


def test_r3_won_keeps_a_close_date_set_in_the_same_save(make, conn):
    deal = make.deal(stage="negotiation")
    changed = deals.change(
        conn, deal["id"], {"stage": "won", "close_date": date(2026, 6, 10)}, by=DANA.id
    )
    assert (changed["close_date"], changed["probability"]) == (date(2026, 6, 10), 100)


def test_r3_won_makes_the_main_contact_a_customer_linked_to_the_deal(make, conn):
    contact = make.contact(status="qualified")
    deal = make.deal(contact_id=contact["id"], stage="negotiation")
    deals.move(conn, deal["id"], "won", 0, by=DANA.id)
    assert contacts.get_row(conn, contact["id"])["status"] == "customer"
    assert status_history(conn, contact["id"]) == [("qualified", "customer", deal["id"])]


def test_r3_won_with_a_contact_already_a_customer_adds_no_status_change(make, conn):
    contact = make.contact(status="customer")
    deal = make.deal(contact_id=contact["id"], stage="negotiation")
    deals.move(conn, deal["id"], "won", 0, by=DANA.id)
    assert status_history(conn, contact["id"]) == []


def test_r3_won_with_no_main_contact_changes_no_contact(make, conn):
    contact = make.contact(status="lead")
    deal = make.deal(stage="negotiation")
    deals.move(conn, deal["id"], "won", 0, by=DANA.id)
    assert contacts.get_row(conn, contact["id"])["status"] == "lead"
    assert conn.execute(sa.select(sa.func.count()).select_from(status_changes)).scalar() == 0


def test_r3_moving_out_of_won_keeps_the_close_date_and_the_customer(make, conn):
    """Concern 8."""
    contact = make.contact(status="qualified")
    deal = make.deal(contact_id=contact["id"], stage="negotiation", close_date=date(2026, 8, 1))
    # Won on a day other than today, so a close date reset to today would show.
    deals.change(conn, deal["id"], {"stage": "won", "close_date": date(2026, 5, 2)}, by=DANA.id)
    back = deals.move(conn, deal["id"], "negotiation", 0, by=DANA.id)
    assert (back["close_date"], back["probability"]) == (date(2026, 5, 2), 75)
    assert contacts.get_row(conn, contact["id"])["status"] == "customer"
    again = deals.change(conn, deal["id"], {"stage": "proposal"}, by=DANA.id)
    assert again["close_date"] == date(2026, 5, 2)


def test_r3_stage_changes_are_timed_now(make, conn):
    deal = make.deal()
    deals.move(conn, deal["id"], "qualified", 0, by=DANA.id)
    times = conn.execute(sa.select(stage_changes.c.changed_at)).scalars().all()
    assert times == [NOW, NOW]


# R4


def test_r4_a_hand_set_probability_survives_an_edit_that_keeps_the_stage(make, conn):
    deal = make.deal(stage="proposal")
    deals.change(conn, deal["id"], {"probability": 65}, by=DANA.id)
    changed = deals.change(
        conn, deal["id"], {"name": "Renamed", "value": 12_000, "stage": "proposal"}, by=DANA.id
    )
    assert changed["probability"] == 65


def test_r4_won_must_be_100(make, conn):
    deal = make.deal(stage="won")
    with pytest.raises(Invalid) as error:
        deals.change(conn, deal["id"], {"probability": 90}, by=DANA.id)
    assert error.value.errors == {"probability": "Won deals are always 100%."}


def test_r4_lost_must_be_0(make, conn):
    deal = make.deal(stage="negotiation")
    with pytest.raises(Invalid) as error:
        deals.change(conn, deal["id"], {"stage": "lost", "probability": 10}, by=DANA.id)
    assert error.value.errors == {"probability": "Lost deals are always 0%."}


def test_r4_returns_422_through_the_api(client):
    deal = client.post("/api/deals", json={"name": "D", "value": 1000, "stage": "won"}).json()
    response = client.patch(f"/api/deals/{deal['id']}", json={"probability": 50})
    assert response.status_code == 422
    assert response.json() == {"errors": {"probability": "Won deals are always 100%."}}


# R5


def test_r5_a_new_deal_goes_to_the_top_of_its_column(make, conn):
    make.deal(name="First", stage="proposal")
    make.deal(name="Second", stage="proposal")
    assert column(conn, "proposal") == [("Second", 0), ("First", 1)]


def test_r5_moving_within_a_column_changes_only_positions(make, conn):
    a = make.deal(name="A", stage="proposal")
    make.deal(name="B", stage="proposal")
    make.deal(name="C", stage="proposal")
    # The column is C, B, A. Move A to the top.
    moved = deals.move(conn, a["id"], "proposal", 0, by=DANA.id)
    assert column(conn, "proposal") == [("A", 0), ("C", 1), ("B", 2)]
    assert history(conn, a["id"]) == [(None, "proposal")]
    assert moved["probability"] == 50


def test_r5_moving_between_columns_renumbers_both_from_0(make, conn):
    for name in ("A", "B", "C"):
        make.deal(name=name, stage="new")
    for name in ("X", "Y"):
        make.deal(name=name, stage="qualified")
    # New is C, B, A and Qualified is Y, X. Move B to the middle of Qualified.
    b = next(d for d in deals.list_all(conn) if d["name"] == "B")
    deals.move(conn, b["id"], "qualified", 1, by=DANA.id)
    assert column(conn, "new") == [("C", 0), ("A", 1)]
    assert column(conn, "qualified") == [("Y", 0), ("B", 1), ("X", 2)]


def test_r5_an_index_past_the_end_is_clamped(make, conn):
    a = make.deal(name="A", stage="new")
    make.deal(name="X", stage="qualified")
    deals.move(conn, a["id"], "qualified", 99, by=DANA.id)
    assert column(conn, "qualified") == [("X", 0), ("A", 1)]


def test_r5_a_stage_changed_through_patch_goes_to_the_top(make, conn):
    make.deal(name="X", stage="qualified")
    make.deal(name="Y", stage="qualified")
    a = make.deal(name="A", stage="new")
    deals.change(conn, a["id"], {"stage": "qualified"}, by=DANA.id)
    assert column(conn, "qualified") == [("A", 0), ("Y", 1), ("X", 2)]


def test_r5_deleting_closes_the_gap(make, conn):
    make.deal(name="A", stage="new")
    b = make.deal(name="B", stage="new")
    make.deal(name="C", stage="new")
    deals.delete(conn, b["id"])
    assert column(conn, "new") == [("C", 0), ("A", 1)]


# R6


def test_r6_adding_records_added_at_its_stage(make, conn):
    deal = make.deal(stage="proposal")
    assert history(conn, deal["id"]) == [(None, "proposal")]
    assert deals.get(conn, deal["id"])["timeline"][0]["text"] == "Added at Proposal"


def test_r6_adding_at_won_applies_r3(make, conn):
    contact = make.contact(status="lead")
    deal = make.deal(stage="won", contact_id=contact["id"], close_date=None)
    assert (deal["probability"], deal["close_date"], deal["position"]) == (100, TODAY, 0)
    assert history(conn, deal["id"]) == [(None, "won")]
    assert status_history(conn, contact["id"]) == [("lead", "customer", deal["id"])]


def test_r6_adding_at_lost_applies_r3(make):
    deal = make.deal(stage="lost", close_date=None)
    assert (deal["probability"], deal["close_date"]) == (0, TODAY)


def test_an_open_deal_needs_a_close_date(make):
    with pytest.raises(Invalid) as error:
        make.deal(stage="new", close_date=None)
    assert error.value.errors == {"close_date": "Enter a close date."}
