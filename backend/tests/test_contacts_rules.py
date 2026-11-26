import sqlalchemy as sa

from backend.services import contacts
from backend.tables import status_changes
from backend.tests.conftest import NOW


def changes(conn, contact_id):
    query = (
        sa.select(
            status_changes.c.from_status, status_changes.c.to_status, status_changes.c.changed_at
        )
        .where(status_changes.c.contact_id == contact_id)
        .order_by(status_changes.c.id)
    )
    return [tuple(r) for r in conn.execute(query)]


def test_r7_status_starts_as_lead(client):
    response = client.post("/api/contacts", json={"name": "Aiko Tanaka"})
    assert response.status_code == 201
    assert response.json()["status"] == "lead"


def test_r7_every_change_by_hand_in_any_direction_is_recorded(make, conn):
    contact = make.contact()
    contacts.change(conn, contact["id"], {"status": "qualified"})
    contacts.change(conn, contact["id"], {"status": "customer"})
    contacts.change(conn, contact["id"], {"status": "lead"})
    assert changes(conn, contact["id"]) == [
        ("lead", "qualified", NOW),
        ("qualified", "customer", NOW),
        ("customer", "lead", NOW),
    ]
    texts = [e["text"] for e in contacts.get(conn, contact["id"])["timeline"]]
    assert "Status changed from Lead to Qualified" in texts


def test_r7_saving_the_same_status_records_nothing(make, conn):
    contact = make.contact(status="qualified")
    contacts.change(conn, contact["id"], {"status": "qualified", "phone": "555 0100"})
    assert changes(conn, contact["id"]) == []


def test_an_organization_is_optional(client):
    response = client.post(
        "/api/contacts", json={"name": "Grace Whitfield", "organization_id": None}
    )
    assert response.status_code == 201
    assert response.json()["organization_id"] is None


def test_a_badly_formed_email_returns_422(client):
    response = client.post("/api/contacts", json={"name": "Grace", "email": "grace@"})
    assert response.status_code == 422
    assert response.json() == {"errors": {"email": "Enter an email address like name@example.com."}}


def test_an_empty_email_is_no_email(client):
    response = client.post("/api/contacts", json={"name": "Grace", "email": "  "})
    assert response.status_code == 201
    assert response.json()["email"] is None
