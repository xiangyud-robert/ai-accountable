import pytest

ORGANIZATION_ROW = {
    "id", "name", "website", "industry", "notes", "contact_count", "deal_count",
    "open_deal_count", "open_value", "created_at", "updated_at",
}
CONTACT_ROW = {
    "id", "name", "email", "phone", "job_title", "organization_id", "organization_name",
    "status", "deal_count", "activity_count", "created_at", "updated_at",
}
DEAL_ROW = {
    "id", "name", "organization_id", "organization_name", "contact_id", "contact_name", "stage",
    "value", "probability", "expected", "close_date", "position", "late", "activity_count",
    "created_at", "updated_at",
}
ACTIVITY = {
    "id", "type", "contact_id", "deal_id", "description", "occurred_at", "follow_up_date",
    "follow_up_done", "created_at", "updated_at",
}
TIMELINE_ENTRY = {
    "key", "kind", "id", "at", "text", "record", "type", "follow_up_date", "follow_up_done", "follow_up_overdue",
    "from_value", "to_value", "contact_id", "contact_name", "deal_id", "deal_name",
}
DASHBOARD = {
    "today", "this_month", "last_month", "months", "last_12_months", "open", "by_stage",
    "funnel", "lost", "follow_ups", "recent",
}


@pytest.fixture
def records(client):
    org = client.post("/api/organizations", json={"name": "Harbor Logistics"}).json()
    contact = client.post("/api/contacts", json={"name": "Priya Raman", "organization_id": org["id"]}).json()
    deal = client.post(
        "/api/deals",
        json={
            "name": "Harbor Logistics fleet analytics",
            "organization_id": org["id"],
            "contact_id": contact["id"],
            "value": 72_000,
            "close_date": "2026-07-01",
        },
    ).json()
    activity = client.post(
        "/api/activities",
        json={"type": "call", "deal_id": deal["id"], "description": "Kick-off", "follow_up_date": "2026-06-18"},
    ).json()
    return {"org": org, "contact": contact, "deal": deal, "activity": activity}


def test_stages_in_order_with_the_spec_s_probabilities(client):
    response = client.get("/api/stages")
    assert response.status_code == 200
    assert response.json() == [
        {"key": "new", "name": "New", "order": 1, "probability": 10, "open": True},
        {"key": "qualified", "name": "Qualified", "order": 2, "probability": 25, "open": True},
        {"key": "proposal", "name": "Proposal", "order": 3, "probability": 50, "open": True},
        {"key": "negotiation", "name": "Negotiation", "order": 4, "probability": 75, "open": True},
        {"key": "won", "name": "Won", "order": 5, "probability": 100, "open": False},
        {"key": "lost", "name": "Lost", "order": 6, "probability": 0, "open": False},
    ]


def test_organization_endpoints(client, records):
    org_id = records["org"]["id"]
    assert set(records["org"]) == ORGANIZATION_ROW
    [row] = client.get("/api/organizations").json()
    assert set(row) == ORGANIZATION_ROW
    assert (row["contact_count"], row["deal_count"], row["open_deal_count"], row["open_value"]) == (1, 1, 1, 72_000)
    detail = client.get(f"/api/organizations/{org_id}").json()
    assert set(detail) == ORGANIZATION_ROW | {"contacts", "deals", "won_value"}
    assert set(detail["contacts"][0]) == CONTACT_ROW
    assert set(detail["deals"][0]) == DEAL_ROW
    changed = client.patch(f"/api/organizations/{org_id}", json={"industry": "Logistics"})
    assert changed.status_code == 200 and changed.json()["industry"] == "Logistics"
    assert client.delete(f"/api/organizations/{org_id}").status_code == 204


def test_contact_endpoints(client, records):
    contact_id = records["contact"]["id"]
    assert set(records["contact"]) == CONTACT_ROW
    assert set(client.get("/api/contacts").json()[0]) == CONTACT_ROW
    detail = client.get(f"/api/contacts/{contact_id}").json()
    assert set(detail) == CONTACT_ROW | {"organization", "deals", "timeline"}
    assert detail["organization"] == {"id": records["org"]["id"], "name": "Harbor Logistics"}
    assert set(detail["timeline"][0]) == TIMELINE_ENTRY
    changed = client.patch(f"/api/contacts/{contact_id}", json={"status": "qualified"})
    assert changed.status_code == 200 and changed.json()["status"] == "qualified"
    assert client.delete(f"/api/contacts/{contact_id}").status_code == 204


def test_deal_endpoints(client, records):
    deal_id = records["deal"]["id"]
    assert set(records["deal"]) == DEAL_ROW
    assert set(client.get("/api/deals").json()[0]) == DEAL_ROW
    detail = client.get(f"/api/deals/{deal_id}").json()
    assert set(detail) == DEAL_ROW | {"timeline"}
    assert [e["kind"] for e in detail["timeline"]] == ["stage_change", "activity"]
    moved = client.post(f"/api/deals/{deal_id}/move", json={"stage": "proposal", "index": 2})
    assert moved.status_code == 200 and (moved.json()["stage"], moved.json()["position"]) == ("proposal", 0)
    changed = client.patch(f"/api/deals/{deal_id}", json={"value": 80_000})
    assert changed.status_code == 200 and changed.json()["value"] == 80_000
    assert client.delete(f"/api/deals/{deal_id}").status_code == 204


def test_activity_endpoints(client, records):
    activity_id = records["activity"]["id"]
    assert set(records["activity"]) == ACTIVITY
    changed = client.patch(f"/api/activities/{activity_id}", json={"follow_up_done": True})
    assert changed.status_code == 200 and changed.json()["follow_up_done"] is True
    assert client.delete(f"/api/activities/{activity_id}").status_code == 204


def test_dashboard_endpoint(client, records):
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == DASHBOARD
    assert body["today"] == "2026-06-15"
    assert len(body["months"]) == 12
    assert [f["stage"] for f in body["funnel"]] == ["new", "qualified", "proposal", "negotiation", "won"]
    assert body["follow_ups"][0]["deal_name"] == "Harbor Logistics fleet analytics"
    assert set(body["recent"][0]) == TIMELINE_ENTRY


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/organizations/999"),
        ("patch", "/api/organizations/999"),
        ("delete", "/api/organizations/999"),
        ("get", "/api/contacts/999"),
        ("patch", "/api/contacts/999"),
        ("delete", "/api/contacts/999"),
        ("get", "/api/deals/999"),
        ("patch", "/api/deals/999"),
        ("delete", "/api/deals/999"),
        ("patch", "/api/activities/999"),
        ("delete", "/api/activities/999"),
    ],
)
def test_404_for_a_missing_record(client, method, path):
    kwargs = {"json": {}} if method == "patch" else {}
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == 404


def test_404_names_the_kind_of_record(client):
    assert client.get("/api/deals/999").json() == {"detail": "This deal no longer exists"}
    response = client.post("/api/deals/999/move", json={"stage": "won", "index": 0})
    assert response.status_code == 404


@pytest.mark.parametrize(
    ("path", "detail"),
    [
        ("/api/deals/9223372036854775808", "This deal no longer exists"),
        ("/api/contacts/2147483648", "This contact no longer exists"),
        ("/api/organizations/1e+21", "This organization no longer exists"),
    ],
)
def test_an_id_that_cant_be_a_record_s_is_a_404(client, path, detail):
    response = client.get(path)
    assert response.status_code == 404
    assert response.json() == {"detail": detail}
    assert client.patch("/api/activities/99999999999999999999", json={}).status_code == 404


def test_a_linked_id_too_big_to_store_is_a_422(client):
    response = client.post("/api/contacts", json={"name": "A", "organization_id": 10**20})
    assert response.status_code == 422
    assert response.json() == {"errors": {"organization_id": "Choose an organization from the list."}}
    response = client.post("/api/activities", json={"type": "note", "deal_id": 2**31, "description": "Call"})
    assert response.status_code == 422


def test_only_requests_addressed_to_this_computer_are_answered(client):
    # A page that points its own name at 127.0.0.1 (DNS rebinding) sends its own name.
    assert client.get("/api/contacts", headers={"Host": "evil.example:8000"}).status_code == 400
    assert client.get("/api/contacts", headers={"Host": "localhost:5173"}).status_code == 200
    assert client.get("/api/contacts", headers={"Host": "127.0.0.1:8000"}).status_code == 200


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_there_are_no_api_docs(client, path):
    assert client.get(path).status_code == 404


@pytest.mark.parametrize(
    ("path", "body", "errors"),
    [
        ("/api/organizations", {"name": ""}, {"name": "Enter a name."}),
        ("/api/organizations", {}, {"name": "Enter a name."}),
        ("/api/organizations", {"name": "x" * 121}, {"name": "Keep this to 120 characters or fewer."}),
        ("/api/organizations", {"name": "A", "notes": "x" * 5001}, {"notes": "Keep this to 5,000 characters or fewer."}),
        ("/api/contacts", {"name": "A", "status": "vip"}, {"status": "Choose lead, qualified or customer."}),
        ("/api/contacts", {"name": "A", "organization_id": 999}, {"organization_id": "That organization no longer exists."}),
        ("/api/deals", {"name": "D", "value": -5, "close_date": "2026-07-01"}, {"value": "Enter a value from $0 to $100,000,000."}),
        ("/api/deals", {"name": "D", "value": "lots", "close_date": "2026-07-01"}, {"value": "Enter a value from $0 to $100,000,000."}),
        ("/api/deals", {"name": "D", "value": 5, "probability": 101, "close_date": "2026-07-01"}, {"probability": "Enter a probability from 0 to 100."}),
        ("/api/deals", {"name": "D", "value": 5, "stage": "maybe", "close_date": "2026-07-01"}, {"stage": "Choose a stage."}),
        ("/api/deals", {"name": "D", "value": 5, "close_date": "soon"}, {"close_date": "Enter a close date."}),
        ("/api/deals", {"name": "D", "value": 5, "contact_id": 999, "close_date": "2026-07-01"}, {"contact_id": "That contact no longer exists."}),
        ("/api/deals", {"name": "D", "value": 5, "colour": "red", "close_date": "2026-07-01"}, {"colour": "Accountable doesn't know this field."}),
    ],
)
def test_422_for_bad_fields(client, path, body, errors):
    response = client.post(path, json=body)
    assert response.status_code == 422
    assert response.json() == {"errors": errors}


def test_422_lists_every_bad_field(client):
    response = client.post("/api/deals", json={"name": " ", "value": -1, "close_date": "2026-07-01"})
    assert response.json() == {
        "errors": {"name": "Enter a name.", "value": "Enter a value from $0 to $100,000,000."}
    }


def test_a_required_field_cant_be_patched_to_null(client, records):
    response = client.patch(f"/api/deals/{records['deal']['id']}", json={"name": None})
    assert response.status_code == 422
    assert response.json() == {"errors": {"name": "Enter a name."}}


def test_https_is_added_to_a_website_with_no_scheme(client):
    assert client.post("/api/organizations", json={"name": "A", "website": "harbor.example"}).json()["website"] == "https://harbor.example"
    assert client.post("/api/organizations", json={"name": "B", "website": "http://b.example"}).json()["website"] == "http://b.example"


@pytest.mark.parametrize("website", ["javascript://%0aalert(1)", "file:///etc/passwd", "data://text/html,hi", "ftp://files.example"])
def test_a_website_must_be_a_web_address(client, website):
    response = client.post("/api/organizations", json={"name": "A", "website": website})
    assert response.status_code == 422
    assert response.json() == {"errors": {"website": "Enter a website address, such as example.com."}}


def test_a_website_s_length_counts_the_https_added_to_it(client):
    fits = "a" * 292
    assert client.post("/api/organizations", json={"name": "A", "website": fits}).json()["website"] == f"https://{fits}"
    response = client.post("/api/organizations", json={"name": "B", "website": fits + "a"})
    assert response.status_code == 422
    assert response.json() == {"errors": {"website": "Keep this to 300 characters or fewer."}}


def test_patch_with_some_fields_changes_only_those(client, records):
    org_id = records["org"]["id"]
    client.patch(f"/api/organizations/{org_id}", json={"website": "harbor.example", "notes": "Fleet of 400 trucks"})
    changed = client.patch(f"/api/organizations/{org_id}", json={"notes": "Fleet of 450 trucks"}).json()
    assert (changed["name"], changed["website"], changed["notes"]) == (
        "Harbor Logistics",
        "https://harbor.example",
        "Fleet of 450 trucks",
    )
    deal = client.patch(f"/api/deals/{records['deal']['id']}", json={"name": "Renamed"}).json()
    assert (deal["name"], deal["value"], deal["stage"], deal["close_date"]) == ("Renamed", 72_000, "new", "2026-07-01")


def test_patch_can_clear_an_optional_field(client, records):
    contact_id = records["contact"]["id"]
    client.patch(f"/api/contacts/{contact_id}", json={"phone": "555 0100"})
    cleared = client.patch(f"/api/contacts/{contact_id}", json={"phone": None, "organization_id": None}).json()
    assert (cleared["phone"], cleared["organization_id"]) == (None, None)
