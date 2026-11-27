"""R15: signed out, every address under /api answers 401, whether or not it exists, before
anything else is checked. The one exception is the stand-in's sign-in (concern 18)."""

import re

import pytest
from fastapi.routing import iter_route_contexts

from backend.auth import STAND_IN_SIGN_IN
from backend.main import create_app
from backend.tests.conftest import DANA

SIGN_IN = {"detail": "Sign in to carry on."}


def api_routes() -> list[tuple[str, str]]:
    """Every method and address the app has under /api, from the app itself, so a new route
    is checked without changing this test. Each {id} in an address becomes 1."""
    routes = iter_route_contexts(create_app().routes)
    return sorted(
        (method, re.sub(r"\{[^}]+\}", "1", route.path))
        for route in routes
        if route.path and route.path.startswith("/api")
        for method in route.methods or ()
    )


EVERY_ROUTE = [route for route in api_routes() if route[1] != STAND_IN_SIGN_IN]


def test_the_routes_are_found_from_the_app():
    paths = {path for _method, path in EVERY_ROUTE}
    assert {"/api/me", "/api/stages", "/api/deals/1/move", "/api/dashboard"} <= paths
    assert len(EVERY_ROUTE) >= 20


@pytest.mark.parametrize(("method", "path"), EVERY_ROUTE)
def test_signed_out_every_route_answers_401(signed_out_client, method, path):
    response = signed_out_client.request(method, path, json={})
    assert response.status_code == 401
    assert response.json() == SIGN_IN


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("GET", "/api", None),
        ("GET", "/api/no-such-thing", None),
        ("GET", "/api/deals/1/no-such-thing", None),
        ("PUT", "/api/deals", None),  # a wrong method
        ("DELETE", "/api/stages", None),
        ("POST", "/api/organizations", "{not json"),  # broken JSON
        ("POST", "/api/organizations", '{"name": ""}'),  # a field that fails its check
        ("GET", "/api/deals/abc", None),  # an id that can't be a record's
        ("GET", "/api/deals/99999999999999999999", None),
    ],
)
def test_signed_out_anything_else_under_api_answers_401_too(signed_out_client, method, path, body):
    headers = {"Content-Type": "application/json"} if body else {}
    response = signed_out_client.request(method, path, content=body, headers=headers)
    assert response.status_code == 401
    assert response.json() == SIGN_IN


def test_the_stand_in_s_sign_in_answers_signed_out_with_the_stand_in_on(signed_out_client):
    response = signed_out_client.post(
        STAND_IN_SIGN_IN, json={"email": DANA.email, "password": "accountable"}
    )
    assert response.status_code == 200


def test_with_the_stand_in_off_its_sign_in_is_a_401_like_any_other(supabase_client):
    response = supabase_client.post(
        STAND_IN_SIGN_IN, json={"email": DANA.email, "password": "accountable"}
    )
    assert response.status_code == 401
    assert response.json() == SIGN_IN


@pytest.mark.parametrize("path", ["/", "/deals/12", "/organizations", "/apiary"])
def test_pages_outside_api_aren_t_refused(signed_out_client, path):
    # The sign-in screen has to load.
    assert signed_out_client.get(path).status_code != 401
