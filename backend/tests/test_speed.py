import time

import pytest

from backend import db, seed
from backend.tests.conftest import TODAY

ENDPOINTS = [
    "/api/organizations",
    "/api/contacts",
    "/api/deals",
    "/api/dashboard",
    # Search reads every name of the three kinds (risk 15). "a" is in nearly all of them.
    "/api/search?q=a",
]


@pytest.fixture
def large(engine):
    with db.transaction(engine) as conn:
        seed.load(conn, TODAY, large=True)


@pytest.mark.parametrize("path", ENDPOINTS)
def test_list_endpoints_the_dashboard_and_search_answer_in_under_300ms(client, large, path):
    client.get(path)  # the first request warms up the connection
    start = time.perf_counter()
    response = client.get(path)
    elapsed = time.perf_counter() - start
    assert response.status_code == 200
    assert elapsed < 0.3, f"{path} took {elapsed * 1000:.0f}ms"
