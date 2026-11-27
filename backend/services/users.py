"""The people who use Accountable (concern 19), and how each one shows (R16)."""

from dataclasses import dataclass

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql, sqlite

from backend.tables import users

EMAIL_LENGTH = 254
DISPLAY_NAME_LENGTH = 120


def name(email: str, display_name: str | None) -> str:
    """R16: their display name, or their email until one is set."""
    return display_name or email


def initials(email: str, display_name: str | None) -> str:
    """R16: the first letters of the first two words of the display name, or the email's first."""
    if display_name:
        return "".join(word[0] for word in display_name.split()[:2]).upper()
    return email[:1].upper()


@dataclass(frozen=True)
class Person:
    """Someone signed in, as their token names them."""

    id: str
    email: str
    display_name: str | None

    @property
    def name(self) -> str:
        return name(self.email, self.display_name)

    @property
    def initials(self) -> str:
        return initials(self.email, self.display_name)


def person(user_id: str, email: str, display_name: object) -> Person:
    """A display name of only spaces counts as none, and a long one is cut to fit."""
    if isinstance(display_name, str):
        display_name = display_name.strip()[:DISPLAY_NAME_LENGTH].strip() or None
    else:
        display_name = None
    return Person(user_id, email.strip()[:EMAIL_LENGTH], display_name)


def as_shown(user_id: str | None, email: str | None, display_name: str | None) -> dict | None:
    """A person as the API gives them in created_by and updated_by, or None for no one."""
    if user_id is None or email is None:
        return None
    return {
        "id": user_id,
        "name": name(email, display_name),
        "initials": initials(email, display_name),
    }


def _known(conn: sa.Connection, user_id: str) -> sa.Row | None:
    query = sa.select(users.c.email, users.c.display_name).where(users.c.id == user_id)
    return conn.execute(query).first()


def _insert_unless_there(conn: sa.Connection):
    # Two first requests at once would both find no one, so the second insert does nothing.
    dialect = postgresql if conn.dialect.name == "postgresql" else sqlite
    return dialect.insert(users).on_conflict_do_nothing(index_elements=[users.c.id])


def remember(conn: sa.Connection, someone: Person) -> None:
    """Concern 19: adds them the first time, and writes again only when their email or
    display name has changed."""
    details = {"email": someone.email, "display_name": someone.display_name}
    known = _known(conn, someone.id)
    if known is None:
        conn.execute(_insert_unless_there(conn).values(id=someone.id, **details))
    elif (known.email, known.display_name) != (someone.email, someone.display_name):
        conn.execute(users.update().where(users.c.id == someone.id).values(**details))


class People:
    """Joins users to a record's table, for who added it and who last changed it (R17)."""

    def __init__(self, table: sa.Table, *, changed: bool = True):
        self.table = table
        self.keys = ("created_by", "updated_by") if changed else ("created_by",)
        self.aliases = {key: users.alias(f"{table.name}_{key}") for key in self.keys}

    def join(self, from_clause: sa.FromClause) -> sa.FromClause:
        for key, alias in self.aliases.items():
            from_clause = from_clause.outerjoin(alias, self.table.c[key] == alias.c.id)
        return from_clause

    def columns(self) -> list[sa.Label]:
        return [
            column
            for key, alias in self.aliases.items()
            for column in (
                alias.c.email.label(f"{key}_email"),
                alias.c.display_name.label(f"{key}_display_name"),
            )
        ]

    def take(self, row: dict) -> dict:
        """Puts each person, as the API gives them, in place of their id and details."""
        for key in self.keys:
            email, display_name = row.pop(f"{key}_email"), row.pop(f"{key}_display_name")
            row[key] = as_shown(row[key], email, display_name)
        return row
