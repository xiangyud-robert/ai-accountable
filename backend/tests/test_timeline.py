from datetime import timedelta

from backend.services import deals, timeline
from backend.tests.conftest import NOW


def texts(entries):
    return [e["text"] for e in entries]


def test_r10_a_deal_timeline_has_its_activities_and_stage_changes(make, conn):
    deal = make.deal(stage="proposal")
    other = make.deal(name="Other deal")
    make.activity(deal_id=deal["id"], description="Sent the proposal", occurred_at=NOW - timedelta(hours=1))
    make.activity(deal_id=other["id"], description="Not this one")
    deals.move(conn, deal["id"], "negotiation", 0)
    assert texts(timeline.for_deal(conn, deal["id"])) == [
        "Moved from Proposal to Negotiation",
        "Added at Proposal",
        "Sent the proposal",
    ]


def test_r10_a_contact_timeline_adds_their_deals_and_status_changes(make, conn):
    contact = make.contact(status="qualified")
    deal = make.deal(name="Northwind analytics rollout", contact_id=contact["id"], stage="negotiation")
    make.activity(contact_id=contact["id"], description="Own note", occurred_at=NOW - timedelta(hours=3))
    make.activity(deal_id=deal["id"], description="Deal call", type="call", occurred_at=NOW - timedelta(hours=2))
    deals.move(conn, deal["id"], "won", 0)
    entries = timeline.for_contact(conn, contact["id"])
    assert [(e["text"], e["record"], e["deal_name"]) for e in entries] == [
        ("Became a customer when Northwind analytics rollout was won", "contact", "Northwind analytics rollout"),
        ("Moved from Negotiation to Won", "deal", "Northwind analytics rollout"),
        ("Added at Negotiation", "deal", "Northwind analytics rollout"),
        ("Deal call", "deal", "Northwind analytics rollout"),
        ("Own note", "contact", None),
    ]


def test_concern_10_changing_the_main_contact_moves_the_entries(make, conn):
    first = make.contact(name="First")
    second = make.contact(name="Second")
    deal = make.deal(contact_id=first["id"])
    make.activity(deal_id=deal["id"], description="Deal note")
    deals.change(conn, deal["id"], {"contact_id": second["id"]})
    assert texts(timeline.for_contact(conn, first["id"])) == []
    assert texts(timeline.for_contact(conn, second["id"])) == ["Added at New", "Deal note"]


def test_a_deal_with_no_main_contact_is_on_nobody_s_timeline(make, conn):
    contact = make.contact()
    deal = make.deal()
    make.activity(deal_id=deal["id"])
    assert timeline.for_contact(conn, contact["id"]) == []


def test_newest_first_with_ties_broken_by_id(make, conn):
    contact = make.contact()
    for n in range(3):
        make.activity(contact_id=contact["id"], description=f"Same time {n}")
    make.activity(contact_id=contact["id"], description="Older", occurred_at=NOW - timedelta(days=1))
    assert texts(timeline.for_contact(conn, contact["id"])) == [
        "Same time 2",
        "Same time 1",
        "Same time 0",
        "Older",
    ]


def test_recent_is_newest_first_across_kinds(make, conn):
    contact = make.contact()
    make.activity(contact_id=contact["id"], description="Yesterday", occurred_at=NOW - timedelta(days=1))
    make.deal(name="Today's deal")
    entries = timeline.recent(conn, 10)
    assert texts(entries) == ["Added at New", "Yesterday"]


def test_stage_and_status_entries_cannot_be_edited_or_deleted(client, saved):
    contact = saved.contact()
    deal = saved.deal(contact_id=contact["id"], stage="won", close_date=None)
    entries = client.get(f"/api/contacts/{contact['id']}").json()["timeline"]
    assert {e["kind"] for e in entries} == {"stage_change", "status_change"}
    # Only activities have an address to change or delete, and these ids aren't activities.
    for entry in entries:
        assert client.patch(f"/api/activities/{entry['id']}", json={"description": "x"}).status_code == 404
        assert client.delete(f"/api/activities/{entry['id']}").status_code == 404
    assert len(client.get(f"/api/deals/{deal['id']}").json()["timeline"]) == 1
