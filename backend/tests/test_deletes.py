import sqlalchemy as sa

from backend.services import activities, contacts, deals, organizations, timeline
from backend.tables import activities as activities_table
from backend.tables import stage_changes, status_changes


def count(conn, table, *where):
    return conn.execute(sa.select(sa.func.count()).select_from(table).where(*where)).scalar()


def test_r11_deleting_an_organization_keeps_its_contacts_and_deals(make, conn):
    org = make.org()
    contact = make.contact(organization_id=org["id"])
    deal = make.deal(organization_id=org["id"], contact_id=contact["id"])
    organizations.delete(conn, org["id"])
    assert contacts.get_row(conn, contact["id"])["organization_id"] is None
    kept = deals.get_row(conn, deal["id"])
    assert (kept["organization_id"], kept["contact_id"]) == (None, contact["id"])


def test_r11_deleting_a_contact(make, conn):
    contact = make.contact(status="qualified")
    deal = make.deal(contact_id=contact["id"])
    make.activity(contact_id=contact["id"], description="On the contact")
    make.activity(deal_id=deal["id"], description="On the deal")
    contacts.change(conn, contact["id"], {"status": "customer"})
    contacts.delete(conn, contact["id"])
    assert deals.get_row(conn, deal["id"])["contact_id"] is None
    assert count(conn, activities_table, activities_table.c.contact_id == contact["id"]) == 0
    assert count(conn, status_changes) == 0
    assert {e["text"] for e in timeline.for_deal(conn, deal["id"])} == {
        "On the deal",
        "Added at New",
    }


def test_r11_deleting_a_deal(make, conn):
    contact = make.contact()
    deal = make.deal(
        name="Northwind analytics rollout", contact_id=contact["id"], stage="won", close_date=None
    )
    make.activity(deal_id=deal["id"])
    deals.delete(conn, deal["id"])
    assert count(conn, activities_table) == 0
    assert count(conn, stage_changes) == 0
    [change] = conn.execute(sa.select(status_changes)).all()
    assert (change.to_status, change.won_deal_id) == ("customer", None)
    [entry] = timeline.for_contact(conn, contact["id"])
    assert entry["text"] == "Status changed from Lead to Customer"
    assert "Northwind" not in entry["text"]


def test_r11_deleting_an_activity_deletes_only_that_one(make, conn):
    contact = make.contact()
    gone = make.activity(contact_id=contact["id"], description="Gone")
    make.activity(contact_id=contact["id"], description="Kept")
    activities.delete(conn, gone["id"])
    assert [e["text"] for e in timeline.for_contact(conn, contact["id"])] == ["Kept"]


def test_the_counts_the_delete_questions_use(make, conn):
    org = make.org()
    priya = make.contact(organization_id=org["id"])
    make.contact(name="Second", organization_id=org["id"])
    make.contact(name="Third", organization_id=org["id"])
    deal = make.deal(organization_id=org["id"], contact_id=priya["id"])
    make.deal(name="Other", organization_id=org["id"], contact_id=priya["id"])
    for _ in range(5):
        make.activity(contact_id=priya["id"])
    for _ in range(4):
        make.activity(deal_id=deal["id"])
    org_row = organizations.get_row(conn, org["id"])
    assert (org_row["contact_count"], org_row["deal_count"]) == (3, 2)
    contact_row = contacts.get_row(conn, priya["id"])
    assert (contact_row["deal_count"], contact_row["activity_count"]) == (2, 5)
    assert deals.get_row(conn, deal["id"])["activity_count"] == 4
