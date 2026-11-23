import time

import pytest

from backend import db, seed
from backend.tests.conftest import TODAY

ENDPOINTS = ["/api/organizations", "/api/contacts", "/api/deals", "/api/dashboard"]


@pytest.fixture
def large(engine):
    with db.transaction(engine) as conn:
        seed.load(conn, TODAY, large=True)


@pytest.mark.parametrize("path", ENDPOINTS)
def test_list_endpoints_and_the_dashboard_answer_in_under_300ms(client, large, path):
    client.get(path)  # the first request warms up the connection
    start = time.perf_counter()
    response = client.get(path)
    elapsed = time.perf_counter() - start
    assert response.status_code == 200
    assert elapsed < 0.3, f"{path} took {elapsed * 1000:.0f}ms"
