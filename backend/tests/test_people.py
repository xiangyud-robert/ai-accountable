"""R16, how a person shows, and concern 19, the users table kept from their tokens."""

import pytest
import sqlalchemy as sa
from sqlalchemy import event

from backend.services import users as users_service
from backend.tables import users

SAM_ID = "5d0c3c5e-7a51-4c1e-9a52-3f0c6c7e2b11"


@pytest.mark.parametrize(
    ("display_name", "name", "initials"),
    [
        ("Dana Holt", "Dana Holt", "DH"),
        ("  Dana Holt  ", "Dana Holt", "DH"),
        ("Nora van der Lindqvist", "Nora van der Lindqvist", "NV"),
        ("dana holt", "dana holt", "DH"),
        ("Cher", "Cher", "C"),
        ("Émile Zola", "Émile Zola", "ÉZ"),
        (None, "sam.rivera@team.example", "S"),
        ("", "sam.rivera@team.example", "S"),
        ("   ", "sam.rivera@team.example", "S"),
        (42, "sam.rivera@team.example", "S"),
    ],
)
def test_r16_a_person_shows_by_their_display_name_or_their_email(display_name, name, initials):
    someone = users_service.person(SAM_ID, "sam.rivera@team.example", display_name)
    assert (someone.name, someone.initials) == (name, initials)


def test_a_display_name_over_120_characters_is_cut_to_120():
    someone = users_service.person(SAM_ID, "sam@team.example", "Sam " + "R" * 200)
    assert someone.display_name == "Sam " + "R" * 116


def stored(client) -> list[tuple]:
    with client.app.state.engine.connect() as conn:
        query = sa.select(users.c.id, users.c.email, users.c.display_name).where(
            users.c.id == SAM_ID
        )
        return [tuple(row) for row in conn.execute(query)]


def me(client, token: str) -> dict:
    response = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    return response.json()


def test_a_first_request_adds_the_person(supabase, supabase_client):
    assert stored(supabase_client) == []
    me(supabase_client, supabase.token())
    assert stored(supabase_client) == [(SAM_ID, "sam.rivera@team.example", "Sam Rivera")]


def test_a_new_email_or_display_name_in_the_token_updates_them(supabase, supabase_client):
    me(supabase_client, supabase.token())
    me(supabase_client, supabase.token(email="sam@team.example"))
    assert stored(supabase_client) == [(SAM_ID, "sam@team.example", "Sam Rivera")]
    shown = me(supabase_client, supabase.token(user_metadata={"display_name": "Samantha Rivera"}))
    assert stored(supabase_client) == [(SAM_ID, "sam.rivera@team.example", "Samantha Rivera")]
    assert (shown["name"], shown["initials"]) == ("Samantha Rivera", "SR")
    me(supabase_client, supabase.token(user_metadata={}))
    assert stored(supabase_client) == [(SAM_ID, "sam.rivera@team.example", None)]


def test_it_writes_only_when_something_changed(supabase, supabase_client):
    me(supabase_client, supabase.token())
    writes = []

    def watch(_conn, _cursor, statement, *_args):
        if statement.lstrip().upper().startswith(("INSERT", "UPDATE")):
            writes.append(statement)

    engine = supabase_client.app.state.engine
    event.listen(engine, "before_cursor_execute", watch)
    for _ in range(3):
        me(supabase_client, supabase.token())
    event.remove(engine, "before_cursor_execute", watch)
    assert writes == []


def test_two_first_requests_at_once_leave_one_row(supabase, supabase_client, monkeypatch):
    # Both requests look before either has added them, so both find no one (risk 8).
    monkeypatch.setattr(users_service, "_known", lambda _conn, _user_id: None)
    me(supabase_client, supabase.token())
    me(supabase_client, supabase.token())
    assert stored(supabase_client) == [(SAM_ID, "sam.rivera@team.example", "Sam Rivera")]
