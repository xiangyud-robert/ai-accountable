"""GET /api/me, and the stand-in's sign-in (concern 18)."""

import pytest

from backend.teammates import TEAMMATES
from backend.tests.conftest import DANA, TEAM_ZONE

WRONG = {"detail": "Wrong email or password."}


def test_me_is_the_signed_in_person_with_the_team_s_time_zone(client):
    assert client.get("/api/me").json() == {
        "id": DANA.id,
        "name": "Dana Holt",
        "email": "dana.holt@example.com",
        "initials": "DH",
        "timezone": TEAM_ZONE,
    }


def test_without_a_team_zone_me_has_none(client, monkeypatch):
    monkeypatch.delenv("ACCOUNTABLE_TIMEZONE")
    assert client.get("/api/me").json()["timezone"] is None


@pytest.mark.parametrize("teammate", TEAMMATES, ids=lambda t: t.display_name)
@pytest.mark.parametrize("case", [str.lower, str.upper, str.title])
def test_the_stand_in_signs_in_each_teammate_by_email_in_any_case(
    signed_out_client, teammate, case
):
    response = signed_out_client.post(
        "/api/stand-in/sign-in", json={"email": case(teammate.email), "password": "accountable"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    me = signed_out_client.get("/api/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert (me["id"], me["name"], me["email"]) == (
        teammate.id,
        teammate.display_name,
        teammate.email,
    )


@pytest.mark.parametrize(
    ("email", "password"),
    [
        (DANA.email, "Accountable"),
        (DANA.email, "wrong"),
        (DANA.email, ""),
        ("sam.rivera@example.com", "accountable"),
        ("", "accountable"),
    ],
)
def test_anything_else_is_a_wrong_email_or_password(signed_out_client, email, password):
    response = signed_out_client.post(
        "/api/stand-in/sign-in", json={"email": email, "password": password}
    )
    assert response.status_code == 401
    assert response.json() == WRONG


def test_the_sign_in_body_takes_only_the_email_and_password(signed_out_client):
    response = signed_out_client.post(
        "/api/stand-in/sign-in",
        json={"email": DANA.email, "password": "accountable", "id": "someone-else"},
    )
    assert response.status_code == 422
    assert signed_out_client.post("/api/stand-in/sign-in", json={}).status_code == 422
