from datetime import date, timedelta

import pytest

from backend.errors import Invalid
from backend.services import activities
from backend.tests.conftest import DANA, NOW


def test_r8_exactly_one_of_contact_or_deal(client, saved):
    contact = saved.contact()
    deal = saved.deal()
    neither = client.post("/api/activities", json={"type": "note", "description": "Hello"})
    both = client.post(
        "/api/activities",
        json={
            "type": "note",
            "description": "Hello",
            "contact_id": contact["id"],
            "deal_id": deal["id"],
        },
    )
    assert neither.status_code == both.status_code == 422
    assert "contact_id" in neither.json()["errors"]
    assert "contact_id" in both.json()["errors"]


def test_r8_now_by_default(make):
    contact = make.contact()
    assert make.activity(contact_id=contact["id"])["occurred_at"] == NOW


def test_r8_a_time_later_than_now_returns_422(client, saved):
    contact = saved.contact()
    response = client.post(
        "/api/activities",
        json={
            "type": "call",
            "description": "Call back",
            "contact_id": contact["id"],
            "occurred_at": (NOW + timedelta(minutes=1)).isoformat(),
        },
    )
    assert response.status_code == 422
    assert response.json() == {"errors": {"occurred_at": "The time can't be later than now."}}


def test_r8_a_time_a_few_seconds_ago_is_fine(make):
    contact = make.contact()
    activity = make.activity(contact_id=contact["id"], occurred_at=NOW - timedelta(seconds=5))
    assert activity["occurred_at"] == NOW - timedelta(seconds=5)


def test_r8_editing_to_a_later_time_than_now_is_refused(make, conn):
    contact = make.contact()
    activity = make.activity(contact_id=contact["id"])
    with pytest.raises(Invalid):
        activities.change(
            conn, activity["id"], {"occurred_at": NOW + timedelta(hours=1)}, by=DANA.id
        )


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("type", "meeting", "Choose note, call or email."),
        ("description", "   ", "Enter a description."),
        ("description", "x" * 5001, "Keep this to 5,000 characters or fewer."),
        ("follow_up_date", "next week", "Enter a follow-up date, or leave it empty."),
    ],
)
def test_type_and_description_rules(client, saved, field, value, message):
    contact = saved.contact()
    body = {"type": "note", "description": "Hello", "contact_id": contact["id"], field: value}
    response = client.post("/api/activities", json=body)
    assert response.status_code == 422
    assert response.json() == {"errors": {field: message}}


def test_marking_a_follow_up_done_and_not_done(make, conn):
    contact = make.contact()
    activity = make.activity(contact_id=contact["id"], follow_up_date=date(2026, 6, 20))
    assert activity["follow_up_done"] is False
    assert (
        activities.change(conn, activity["id"], {"follow_up_done": True}, by=DANA.id)[
            "follow_up_done"
        ]
        is True
    )
    assert (
        activities.change(conn, activity["id"], {"follow_up_done": False}, by=DANA.id)[
            "follow_up_done"
        ]
        is False
    )


def test_done_needs_a_follow_up_date(make, conn):
    contact = make.contact()
    activity = make.activity(contact_id=contact["id"])
    with pytest.raises(Invalid) as error:
        activities.change(conn, activity["id"], {"follow_up_done": True}, by=DANA.id)
    assert error.value.errors == {"follow_up_done": "Add a follow-up date first."}


def test_taking_away_the_follow_up_date_takes_away_done(make, conn):
    contact = make.contact()
    activity = make.activity(
        contact_id=contact["id"], follow_up_date=date(2026, 6, 20), follow_up_done=True
    )
    changed = activities.change(conn, activity["id"], {"follow_up_date": None}, by=DANA.id)
    assert (changed["follow_up_date"], changed["follow_up_done"]) == (None, False)


def test_an_activity_on_a_missing_deal_returns_422(client):
    response = client.post(
        "/api/activities", json={"type": "note", "description": "Hi", "deal_id": 999}
    )
    assert response.status_code == 422
    assert response.json() == {"errors": {"deal_id": "That deal no longer exists."}}
