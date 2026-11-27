"""R18 and concern 21: the top bar's search finds organizations, contacts and deals by name."""

import pytest

KINDS = ("organizations", "contacts", "deals")
NOTHING = {kind: {"total": 0, "results": []} for kind in KINDS}


def search(client, q: str) -> dict:
    response = client.get("/api/search", params={"q": q})
    assert response.status_code == 200
    return response.json()


def names(found: dict, kind: str) -> list[str]:
    return [result["name"] for result in found[kind]["results"]]


@pytest.mark.parametrize("q", ["har", "HAR", "Har", "bor log", "ISTICS", "Harbor Logistics"])
def test_it_finds_a_name_by_any_part_of_it_in_any_case(client, saved, q):
    saved.org(name="Harbor Logistics")
    saved.org(name="Atlas Freight")
    assert names(search(client, q), "organizations") == ["Harbor Logistics"]


def test_it_finds_each_kind(client, saved):
    org = saved.org(name="Harbor Logistics")
    saved.contact(name="Hari Patel")
    saved.deal(name="Harbor Logistics fleet analytics", organization_id=org["id"])
    found = search(client, "har")
    assert [names(found, kind) for kind in KINDS] == [
        ["Harbor Logistics"],
        ["Hari Patel"],
        ["Harbor Logistics fleet analytics"],
    ]


@pytest.mark.parametrize(("q", "found"), [("émile", True), ("ÉMILE", True), ("Emile", False)])
def test_accents_have_their_case_folded_but_still_count(client, saved, q, found):
    # SQLite's own folding covers only A to Z, so it would miss "émile" for "Émile".
    saved.contact(name="Émile Durand")
    assert names(search(client, q), "contacts") == (["Émile Durand"] if found else [])


@pytest.mark.parametrize(
    ("q", "found"),
    [
        ("%", ["100% Growth"]),
        ("0%", ["100% Growth"]),
        ("_", ["Growth_Partners"]),
        ("h_p", ["Growth_Partners"]),
        ("g%h", []),
    ],
)
def test_percent_and_underscore_match_only_themselves(client, saved, q, found):
    for name in ("100% Growth", "Growth_Partners", "Growth Partners"):
        saved.org(name=name)
    assert names(search(client, q), "organizations") == found


@pytest.mark.parametrize("q", ["  har", "har  ", "\tharbor logistics \n"])
def test_spaces_before_and_after_are_ignored(client, saved, q):
    saved.org(name="Harbor Logistics")
    assert names(search(client, q), "organizations") == ["Harbor Logistics"]


def test_spaces_inside_the_search_still_count(client, saved):
    saved.org(name="Harbor Logistics")
    assert search(client, "harbor  logistics") == NOTHING


@pytest.mark.parametrize("q", ["", " ", "   \t "])
def test_empty_or_only_spaces_gives_nothing(client, saved, q):
    saved.org(name="Harbor Logistics")
    saved.contact(name="Priya Raman")
    assert search(client, q) == NOTHING


def test_no_search_at_all_gives_nothing(client, saved):
    saved.org(name="Harbor Logistics")
    response = client.get("/api/search")
    assert (response.status_code, response.json()) == (200, NOTHING)


def test_over_200_characters_is_a_422(client):
    assert client.get("/api/search", params={"q": "a" * 200}).status_code == 200
    response = client.get("/api/search", params={"q": "a" * 201})
    assert response.status_code == 422
    assert response.json() == {"errors": {"q": "Keep this to 200 characters or fewer."}}


def test_up_to_5_of_each_kind_with_the_totals(client, saved):
    for n in range(1, 8):
        saved.org(name=f"Atlas {n}")
        saved.deal(name=f"Atlas renewal {n}")
    for n in range(1, 7):
        saved.contact(name=f"Atlas Contact {n}")
    found = search(client, "atlas")
    assert [len(found[kind]["results"]) for kind in KINDS] == [5, 5, 5]
    assert [found[kind]["total"] for kind in KINDS] == [7, 6, 7]


def test_names_that_start_with_it_come_first_then_the_rest_each_alphabetical(client, saved):
    # Alban Group would come first in plain alphabetical order.
    for name in ("Plan B", "Banyan Tree", "anchor point", "Alban Group", "ANVIL Works", "Andes"):
        saved.org(name=name)
    found = search(client, "an")
    assert names(found, "organizations") == [
        "anchor point",
        "Andes",
        "ANVIL Works",
        "Alban Group",
        "Banyan Tree",
    ]
    assert found["organizations"]["total"] == 6


def test_the_same_order_holds_for_contacts_and_deals(client, saved):
    for name in ("Dana Lee", "Ana Silva", "Alan Brown", "andrew Kim"):
        saved.contact(name=name)
        saved.deal(name=f"{name} renewal")
    found = search(client, "an")
    assert names(found, "contacts") == ["Ana Silva", "andrew Kim", "Alan Brown", "Dana Lee"]
    assert names(found, "deals") == [
        "Ana Silva renewal",
        "andrew Kim renewal",
        "Alan Brown renewal",
        "Dana Lee renewal",
    ]


def test_each_result_has_its_second_line_s_fields(client, saved):
    harbor = saved.org(name="Harbor Logistics", industry="Logistics")
    bare = saved.org(name="Harbor Bare")
    priya = saved.contact(
        name="Priya Harlow", job_title="Finance Director", organization_id=harbor["id"]
    )
    alone = saved.contact(name="Harriet Alone")
    deal = saved.deal(
        name="Harbor fleet analytics",
        organization_id=harbor["id"],
        stage="proposal",
        value=48_000,
    )
    loose = saved.deal(name="Harbor loose end", value=5_000)
    found = search(client, "har")
    assert found["organizations"]["results"] == [
        {"id": bare["id"], "name": "Harbor Bare", "industry": None},
        {"id": harbor["id"], "name": "Harbor Logistics", "industry": "Logistics"},
    ]
    assert found["contacts"]["results"] == [
        {"id": alone["id"], "name": "Harriet Alone", "job_title": None, "organization_name": None},
        {
            "id": priya["id"],
            "name": "Priya Harlow",
            "job_title": "Finance Director",
            "organization_name": "Harbor Logistics",
        },
    ]
    assert found["deals"]["results"] == [
        {
            "id": deal["id"],
            "name": "Harbor fleet analytics",
            "organization_name": "Harbor Logistics",
            "stage": "proposal",
            "value": 48_000,
        },
        {
            "id": loose["id"],
            "name": "Harbor loose end",
            "organization_name": None,
            "stage": "new",
            "value": 5_000,
        },
    ]


def test_no_match_gives_every_kind_empty(client, saved):
    saved.org(name="Harbor Logistics")
    assert search(client, "acme") == NOTHING
