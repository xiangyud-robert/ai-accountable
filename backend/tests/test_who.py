"""R17: who added each record and who last changed it, set from the token, never the request."""

import pytest
import sqlalchemy as sa

from backend.tables import organizations
from backend.tests.conftest import DANA, JOEL, sign_in

DANA_SHOWN = {"id": DANA.id, "name": "Dana Holt", "initials": "DH"}
JOEL_SHOWN = {"id": JOEL.id, "name": "Joel Abara", "initials": "JA"}
ADDED_AT = "2026-06-15T12:00:00"
NEXT_DAY = "2026-06-16"


def as_joel(client):
    return sign_in(client, JOEL.email)


def as_dana(client):
    return sign_in(client, DANA.email)


def who(record: dict) -> tuple:
    return record["created_by"], record["updated_by"]


def add_org(client, **fields) -> dict:
    return client.post("/api/organizations", json={"name": "Harbor Logistics", **fields}).json()


def add_contact(client, **fields) -> dict:
    return client.post("/api/contacts", json={"name": "Priya Raman", **fields}).json()


def add_deal(client, **fields) -> dict:
    body = {"name": "Harbor Logistics fleet analytics", "value": 10_000, "close_date": "2026-07-15"}
    return client.post("/api/deals", json={**body, **fields}).json()


def add_activity(client, **fields) -> dict:
    return client.post(
        "/api/activities", json={"type": "call", "description": "Kick-off", **fields}
    ).json()


@pytest.fixture
def records(client) -> dict:
    """One of each kind, added by Dana."""
    org = add_org(client)
    contact = add_contact(client, organization_id=org["id"])
    deal = add_deal(client, organization_id=org["id"], contact_id=contact["id"])
    activity = add_activity(client, deal_id=deal["id"], follow_up_date="2026-06-18")
    return {"organizations": org, "contacts": contact, "deals": deal, "activities": activity}


def test_adding_sets_both_people_to_whoever_added_it(client):
    as_joel(client)
    org = add_org(client)
    contact = add_contact(client)
    deal = add_deal(client)
    activity = add_activity(client, contact_id=contact["id"])
    for record in (org, contact, deal, activity):
        assert who(record) == (JOEL_SHOWN, JOEL_SHOWN)


@pytest.mark.parametrize(
    ("kind", "change"),
    [
        ("organizations", {"industry": "Logistics"}),
        ("contacts", {"phone": "555 0100"}),
        ("deals", {"value": 12_000}),
        ("activities", {"description": "Kick-off, moved to Tuesday"}),
    ],
)
def test_a_patch_sets_who_last_changed_it(client, records, monkeypatch, kind, change):
    monkeypatch.setenv("ACCOUNTABLE_TODAY", NEXT_DAY)
    changed = as_joel(client).patch(f"/api/{kind}/{records[kind]['id']}", json=change).json()
    assert who(changed) == (DANA_SHOWN, JOEL_SHOWN)
    assert (changed["created_at"], changed["updated_at"]) == (ADDED_AT, f"{NEXT_DAY}T12:00:00")


def test_a_stage_change_by_moving_the_card_sets_who_changed_the_deal(client, records):
    deal = records["deals"]
    moved = as_joel(client).post(
        f"/api/deals/{deal['id']}/move", json={"stage": "proposal", "index": 0}
    )
    assert who(moved.json()) == (DANA_SHOWN, JOEL_SHOWN)


def test_a_stage_change_by_the_form_sets_who_changed_the_deal(client, records):
    deal = records["deals"]
    changed = as_joel(client).patch(f"/api/deals/{deal['id']}", json={"stage": "proposal"})
    assert who(changed.json()) == (DANA_SHOWN, JOEL_SHOWN)


def test_adding_straight_to_won_makes_the_contact_a_customer_changed_by_whoever_added_it(client):
    contact = add_contact(client, status="qualified")
    deal = add_deal(as_joel(client), contact_id=contact["id"], stage="won")
    assert who(deal) == (JOEL_SHOWN, JOEL_SHOWN)
    contact = client.get(f"/api/contacts/{contact['id']}").json()
    assert (contact["status"], *who(contact)) == ("customer", DANA_SHOWN, JOEL_SHOWN)


@pytest.mark.parametrize("how", ["move", "form"])
def test_a_won_deal_makes_its_contact_a_customer_changed_by_whoever_moved_it(client, records, how):
    deal_id, contact_id = records["deals"]["id"], records["contacts"]["id"]
    as_joel(client)
    if how == "move":
        client.post(f"/api/deals/{deal_id}/move", json={"stage": "won", "index": 0})
    else:
        client.patch(f"/api/deals/{deal_id}", json={"stage": "won"})
    contact = client.get(f"/api/contacts/{contact_id}").json()
    assert contact["status"] == "customer"
    assert who(contact) == (DANA_SHOWN, JOEL_SHOWN)


@pytest.mark.parametrize("done", [True, False])
def test_marking_a_follow_up_done_or_not_done_sets_who_changed_it(client, records, done):
    activity_id = records["activities"]["id"]
    if not done:
        client.patch(f"/api/activities/{activity_id}", json={"follow_up_done": True})
    changed = as_joel(client).patch(f"/api/activities/{activity_id}", json={"follow_up_done": done})
    assert changed.json()["follow_up_done"] is done
    assert who(changed.json()) == (DANA_SHOWN, JOEL_SHOWN)


def test_moving_a_card_within_its_column_changes_neither_the_person_nor_the_time(
    client, monkeypatch
):
    first = add_deal(client, name="First")
    second = add_deal(client, name="Second")  # new deals go to the top, so this one is first
    monkeypatch.setenv("ACCOUNTABLE_TODAY", NEXT_DAY)
    as_joel(client).post(f"/api/deals/{first['id']}/move", json={"stage": "new", "index": 0})
    for deal_id in (first["id"], second["id"]):
        deal = client.get(f"/api/deals/{deal_id}").json()
        assert who(deal) == (DANA_SHOWN, DANA_SHOWN)
        assert deal["updated_at"] == ADDED_AT
    assert client.get(f"/api/deals/{first['id']}").json()["position"] == 0


def test_moving_a_card_to_another_column_changes_only_that_card(client, monkeypatch):
    staying = add_deal(client, name="Staying")
    moving = add_deal(client, name="Moving")  # above Staying, which moves up when it goes
    monkeypatch.setenv("ACCOUNTABLE_TODAY", NEXT_DAY)
    as_joel(client).post(f"/api/deals/{moving['id']}/move", json={"stage": "qualified", "index": 0})
    staying = client.get(f"/api/deals/{staying['id']}").json()
    assert (staying["position"], *who(staying), staying["updated_at"]) == (
        0,
        DANA_SHOWN,
        DANA_SHOWN,
        ADDED_AT,
    )


def test_links_emptied_by_a_delete_change_neither_the_person_nor_the_time(
    client, records, monkeypatch
):
    monkeypatch.setenv("ACCOUNTABLE_TODAY", NEXT_DAY)
    as_joel(client)
    client.delete(f"/api/organizations/{records['organizations']['id']}")
    client.delete(f"/api/contacts/{records['contacts']['id']}")
    deal = client.get(f"/api/deals/{records['deals']['id']}").json()
    assert (deal["organization_id"], deal["contact_id"]) == (None, None)
    assert who(deal) == (DANA_SHOWN, DANA_SHOWN)
    assert deal["updated_at"] == ADDED_AT


@pytest.mark.parametrize("field", ["created_by", "updated_by"])
@pytest.mark.parametrize("kind", ["organizations", "contacts", "deals", "activities"])
def test_a_body_with_who_added_or_changed_it_is_a_422(client, records, kind, field):
    new = {
        "organizations": {"name": "Atlas Freight"},
        "contacts": {"name": "Ana Silva"},
        "deals": {"name": "Atlas Freight renewal", "value": 5_000, "close_date": "2026-07-01"},
        "activities": {
            "type": "note",
            "description": "Hello",
            "contact_id": records["contacts"]["id"],
        },
    }[kind]
    added = client.post(f"/api/{kind}", json={**new, field: JOEL.id})
    changed = client.patch(f"/api/{kind}/{records[kind]['id']}", json={field: JOEL.id})
    for response in (added, changed):
        assert response.status_code == 422
        assert response.json() == {"errors": {field: "Accountable doesn't know this field."}}


def test_a_record_with_no_one_recorded_shows_null(client, engine):
    with engine.begin() as conn:
        conn.execute(
            organizations.insert().values(
                name="From before sign-in", created_at=sa.func.now(), updated_at=sa.func.now()
            )
        )
    [org] = client.get("/api/organizations").json()
    assert who(org) == (None, None)
    assert who(client.get(f"/api/organizations/{org['id']}").json()) == (None, None)


def test_lists_pages_timelines_recent_activity_and_follow_ups_carry_the_people(client, records):
    as_joel(client).patch(f"/api/deals/{records['deals']['id']}", json={"value": 12_000})
    as_dana(client)
    org_id, contact_id, deal_id = (records[k]["id"] for k in ("organizations", "contacts", "deals"))

    for kind in ("organizations", "contacts", "deals"):
        [row] = client.get(f"/api/{kind}").json()
        assert row["created_by"] == DANA_SHOWN
    org_page = client.get(f"/api/organizations/{org_id}").json()
    assert who(org_page) == (DANA_SHOWN, DANA_SHOWN)
    assert who(org_page["contacts"][0]) == (DANA_SHOWN, DANA_SHOWN)
    assert who(org_page["deals"][0]) == (DANA_SHOWN, JOEL_SHOWN)

    for page in (client.get(f"/api/deals/{deal_id}"), client.get(f"/api/contacts/{contact_id}")):
        timeline = page.json()["timeline"]
        by_kind = {entry["kind"]: entry["created_by"] for entry in timeline}
        assert by_kind == {"activity": DANA_SHOWN, "stage_change": None}

    dashboard = client.get("/api/dashboard").json()
    assert {entry["kind"]: entry["created_by"] for entry in dashboard["recent"]} == {
        "activity": DANA_SHOWN,
        "stage_change": None,
    }
    assert [f["created_by"] for f in dashboard["follow_ups"]] == [DANA_SHOWN]


def test_a_status_change_in_a_timeline_has_no_one(client, records):
    contact_id = records["contacts"]["id"]
    client.patch(f"/api/contacts/{contact_id}", json={"status": "qualified"})
    timeline = client.get(f"/api/contacts/{contact_id}").json()["timeline"]
    statuses = [entry for entry in timeline if entry["kind"] == "status_change"]
    assert [entry["created_by"] for entry in statuses] == [None]
