"""R15 and concerns 18 and 20: the token check. Supabase is played by the tests' own key pair."""

import base64
import json
import socket
import time
import urllib.request
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from backend import auth
from backend.tests.conftest import (
    DANA,
    JOEL,
    KEY_ID,
    PUBLISHABLE_KEY,
    SUPABASE_ISSUER,
    FakeSupabase,
    NetworkBlocked,
    app_client,
    stand_in_token,
)

SIGN_IN = {"detail": "Sign in to carry on."}
# What someone forging a token might sign with, such as the publishable key everyone has.
A_SHARED_SECRET = (PUBLISHABLE_KEY * 4).encode()


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_a_supabase_token_is_accepted_and_the_person_is_the_token_s(supabase, supabase_client):
    token = supabase.token(sub="1f0e7c2a-0000-4abc-9def-123456789abc", email="sam@team.example")
    response = supabase_client.get("/api/me", headers=bearer(token))
    assert response.status_code == 200
    assert response.json() == {
        "id": "1f0e7c2a-0000-4abc-9def-123456789abc",
        "name": "Sam Rivera",
        "email": "sam@team.example",
        "initials": "SR",
        "timezone": "America/Los_Angeles",
    }


def test_the_public_keys_are_fetched_once_across_many_requests(supabase, supabase_client):
    for _ in range(5):
        assert supabase_client.get("/api/me", headers=bearer(supabase.token())).status_code == 200
    assert supabase.fetches == 1


def test_the_keys_are_asked_for_at_the_project_s_address_with_the_publishable_key(
    supabase, supabase_client
):
    # Risk 4: the address may want the publishable key as apikey. It isn't secret, so it's sent.
    supabase_client.get("/api/me", headers=bearer(supabase.token()))
    assert supabase.asked_with is not None
    address, headers = supabase.asked_with
    assert address == f"{SUPABASE_ISSUER}/.well-known/jwks.json"
    assert headers["apikey"] == PUBLISHABLE_KEY


def _part(value: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b"=").decode()


def unsigned(claims: dict) -> str:
    """A token with "alg": "none" and no signature."""
    return f"{_part({'alg': 'none', 'typ': 'JWT', 'kid': KEY_ID})}.{_part(claims)}."


def _another_key():
    return ec.generate_private_key(ec.SECP256R1())


REFUSED_SUPABASE_TOKENS = {
    # Expiry is checked against the real clock, though ACCOUNTABLE_TODAY fixes the backend's.
    "expired": lambda fake: fake.token(exp=int(time.time()) - 60),
    "no expiry": lambda fake: fake.token(exp=None),
    "another issuer": lambda fake: fake.token(iss="https://other.supabase.co/auth/v1"),
    "no issuer": lambda fake: fake.token(iss=None),
    "another audience": lambda fake: fake.token(aud="anon"),
    "no audience": lambda fake: fake.token(aud=None),
    "another role": lambda fake: fake.token(role="anon"),
    "no role": lambda fake: fake.token(role=None),
    "anonymous user": lambda fake: fake.token(is_anonymous=True),
    "no email": lambda fake: fake.token(email=None),
    "no user id": lambda fake: fake.token(sub=None),
    "signed with another key": lambda fake: fake.token(key=_another_key()),
    "signed with HS256": lambda fake: jwt.encode(
        fake.claims(), A_SHARED_SECRET, algorithm="HS256", headers={"kid": KEY_ID}
    ),
    "signed with none": lambda fake: unsigned(fake.claims()),
    "an unknown key id": lambda fake: fake.token(headers={"kid": "someone-else"}),
    "not a token": lambda _fake: "not-a-token",
}


@pytest.mark.parametrize(
    "make_token", REFUSED_SUPABASE_TOKENS.values(), ids=REFUSED_SUPABASE_TOKENS
)
def test_these_supabase_tokens_are_refused(supabase, supabase_client, make_token):
    response = supabase_client.get("/api/me", headers=bearer(make_token(supabase)))
    assert response.status_code == 401
    assert response.json() == SIGN_IN
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "authorization",
    ["", "Bearer", "Bearer ", "Basic ZGFuYTphY2NvdW50YWJsZQ==", "Token abc", "eyJhbGciOi"],
)
def test_a_missing_or_malformed_header_is_refused(client, authorization):
    response = client.get("/api/me", headers={"Authorization": authorization})
    assert response.status_code == 401
    assert response.json() == SIGN_IN


def test_a_supabase_key_that_isn_t_a_public_key_is_refused(supabase, supabase_client):
    # A shared secret in the key set would let anyone who knows it sign tokens.
    secret = base64.urlsafe_b64encode(A_SHARED_SECRET).rstrip(b"=").decode()
    supabase.key_set = {"keys": [{"kty": "oct", "k": secret, "kid": KEY_ID, "alg": "HS256"}]}
    token = jwt.encode(
        supabase.claims(), A_SHARED_SECRET, algorithm="HS256", headers={"kid": KEY_ID}
    )
    assert supabase_client.get("/api/me", headers=bearer(token)).status_code == 401


def test_a_stand_in_token_is_refused_when_supabase_is_in_use(client, supabase):
    token = stand_in_token(client)
    with app_client() as supabase_app:
        response = supabase_app.get("/api/me", headers=bearer(token))
    assert response.status_code == 401


def test_a_supabase_token_is_refused_when_the_stand_in_is_on(signed_out_client, supabase_keys):
    token = FakeSupabase(*supabase_keys).token()
    response = signed_out_client.get("/api/me", headers=bearer(token))
    assert response.status_code == 401


def test_a_stand_in_token_from_an_earlier_start_is_refused(signed_out_client):
    # Its key is only in memory, so a restart ends every stand-in session (risk 10).
    token = stand_in_token(signed_out_client)
    with app_client() as restarted:
        assert restarted.get("/api/me", headers=bearer(token)).status_code == 401


def test_a_stand_in_token_lasts_12_hours_by_the_real_clock(signed_out_client):
    reply = signed_out_client.post(
        "/api/stand-in/sign-in", json={"email": DANA.email, "password": "accountable"}
    ).json()
    claims = jwt.decode(reply["access_token"], options={"verify_signature": False})
    assert claims["exp"] == reply["expires_at"]
    assert abs(reply["expires_at"] - (time.time() + 12 * 3600)) < 60


def test_an_expired_stand_in_token_is_refused(signed_out_client, monkeypatch):
    thirteen_hours_ago = time.time() - 13 * 3600
    with monkeypatch.context() as earlier:
        earlier.setattr(auth, "time", SimpleNamespace(time=lambda: thirteen_hours_ago))
        token = stand_in_token(signed_out_client)
    assert signed_out_client.get("/api/me", headers=bearer(token)).status_code == 401


def test_a_person_named_in_the_query_or_body_is_ignored(client):
    response = client.request(
        "GET",
        f"/api/me?id={JOEL.id}&email={JOEL.email}&user={JOEL.id}",
        json={"id": JOEL.id, "email": JOEL.email},
        headers={"X-User-Id": JOEL.id},
    )
    assert response.json()["id"] == DANA.id
    added = client.post(
        "/api/organizations", json={"name": "Kestrel Media"}, params={"by": JOEL.id}
    )
    assert added.json()["created_by"]["id"] == DANA.id


def test_when_supabase_can_t_be_reached_the_api_says_so_instead_of_signing_out(
    supabase, supabase_client, monkeypatch
):
    def unreachable(_keys):
        raise jwt.PyJWKClientConnectionError("Fail to fetch data from the url")

    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", unreachable)
    response = supabase_client.get("/api/me", headers=bearer(supabase.token()))
    assert response.status_code == 503
    assert response.json() == {"detail": auth.CANT_REACH_SIGN_IN}


def test_no_test_can_reach_supabase_or_anywhere_else(no_network):
    # conftest refuses every connection off this computer, and records it, so the test fails
    # even when the code under test catches the error.
    with pytest.raises(NetworkBlocked):
        urllib.request.urlopen(f"{SUPABASE_ISSUER}/.well-known/jwks.json", timeout=1)
    with pytest.raises(NetworkBlocked):
        socket.create_connection(("203.0.113.7", 443), timeout=1)
    assert len(no_network) == 2
    no_network.clear()  # so this test itself passes
