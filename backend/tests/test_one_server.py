"""One server: with npm start and on Render, FastAPI serves the built frontend as well as the API."""

import pytest
from fastapi.testclient import TestClient

from backend.main import _built_file, create_app
from backend.tests.conftest import sign_in

PAGE = "<!doctype html><title>Accountable</title>"
SCRIPT = "console.log('Accountable')"
ICON = "<svg xmlns='http://www.w3.org/2000/svg'></svg>"


@pytest.fixture
def built(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text(PAGE)
    (dist / "assets" / "app.js").write_text(SCRIPT)
    (dist / "favicon.svg").write_text(ICON)
    (tmp_path / "secret.txt").write_text("not part of the build")
    return dist


@pytest.fixture
def one_server(built):
    with TestClient(create_app(frontend=built), base_url="http://localhost") as client:
        yield client


@pytest.mark.parametrize(
    "path",
    ["/", "/deals/12", "/organizations", "/no/such/page", "/apiary", "/docs", "/openapi.json"],
)
def test_the_app_s_own_addresses_get_its_page(one_server, path):
    response = one_server.get(path)
    assert response.status_code == 200
    assert response.text == PAGE
    assert response.headers["content-type"].startswith("text/html")
    assert response.headers["cache-control"] == "no-cache"


def test_the_built_files_are_served_as_they_are(one_server):
    script = one_server.get("/assets/app.js")
    icon = one_server.get("/favicon.svg")
    assert (script.status_code, script.text) == (200, SCRIPT)
    assert "javascript" in script.headers["content-type"]
    assert (icon.status_code, icon.text) == (200, ICON)
    assert icon.headers["content-type"].startswith("image/svg+xml")


@pytest.mark.parametrize(
    "path", ["/../secret.txt", "/assets/../../secret.txt", "/%2e%2e/secret.txt"]
)
def test_nothing_outside_the_build_is_served(one_server, path):
    assert "not part of the build" not in one_server.get(path).text


def test_a_name_too_long_for_the_disk_gets_the_page(one_server):
    assert one_server.get("/" + "a" * 5000).text == PAGE


def test_signed_in_an_unknown_api_address_is_still_a_json_404(one_server):
    sign_in(one_server)
    response = one_server.get("/api/nope", headers={"Accept": "text/html"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}
    # A wrong method on an API route is still the API's own answer.
    assert one_server.get("/api/deals/1/move").status_code == 405


def test_signed_out_an_unknown_api_address_is_a_401(one_server):
    assert one_server.get("/api/nope").status_code == 401


def test_without_a_built_frontend_none_of_it_is_served(tmp_path):
    with TestClient(create_app(frontend=tmp_path / "dist"), base_url="http://localhost") as client:
        for path in ["/", "/deals/12", "/assets/app.js"]:
            assert client.get(path).status_code == 404


def test_the_host_check_allows_render_s_address_and_still_refuses_others(monkeypatch):
    monkeypatch.setenv("RENDER_EXTERNAL_HOSTNAME", "accountable.onrender.com")
    with TestClient(create_app(), base_url="http://localhost") as client:
        sign_in(client)
        render = client.get("/api/stages", headers={"Host": "accountable.onrender.com"})
        local = client.get("/api/stages", headers={"Host": "127.0.0.1:8000"})
        other = client.get("/api/stages", headers={"Host": "evil.example"})
    assert (render.status_code, local.status_code, other.status_code) == (200, 200, 400)


def test_without_render_s_address_it_isn_t_allowed():
    with TestClient(create_app(), base_url="http://localhost") as client:
        response = client.get("/api/stages", headers={"Host": "accountable.onrender.com"})
    assert response.status_code == 400


@pytest.mark.parametrize("path", ["../secret.txt", "assets/../../secret.txt", "/etc/hosts", "a\0b"])
def test_the_file_lookup_never_leaves_the_build(built, path):
    # httpx tidies ../ out of addresses before sending, so the lookup is checked directly.
    assert _built_file(built.resolve(), path) is None
    assert _built_file(built.resolve(), "assets/app.js") == built.resolve() / "assets" / "app.js"
