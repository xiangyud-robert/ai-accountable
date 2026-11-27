"""R18 and concern 21: finds organizations, contacts and deals by any part of their name.

SQLite folds the case of A to Z only, so the case is folded here, with str.lower(), the same
way on SQLite and Postgres, rather than left to the database. Every name of the three kinds
is read and matched, sorted and counted in Python, and only the top 5 of each kind get the
fields of their second line from the database. Since nothing is matched with LIKE, a % or _
in the search matches only itself.
"""

from collections.abc import Iterable

import sqlalchemy as sa

from backend.tables import contacts, deals, organizations

SHOWN = 5


def _ranked(rows: Iterable[sa.Row], search: str) -> list[int]:
    """The ids of the names containing search: those that start with it first, then the
    rest, each alphabetical ignoring case, with ties in the order they were added."""
    found = []
    for row in rows:
        name = row.name.lower()
        at = name.find(search)
        if at >= 0:
            found.append((at > 0, name, row.id))
    return [row_id for *_order, row_id in sorted(found)]


def _names(conn: sa.Connection, table: sa.Table) -> list[sa.Row]:
    return list(conn.execute(sa.select(table.c.id, table.c.name)))


def _in_order(conn: sa.Connection, query: sa.Select, table: sa.Table, ids: list[int]) -> list[dict]:
    if not ids:
        return []
    rows = {row.id: dict(row._mapping) for row in conn.execute(query.where(table.c.id.in_(ids)))}
    return [rows[row_id] for row_id in ids]


def _organizations(conn: sa.Connection, ids: list[int]) -> list[dict]:
    query = sa.select(organizations.c.id, organizations.c.name, organizations.c.industry)
    return _in_order(conn, query, organizations, ids)


def _contacts(conn: sa.Connection, ids: list[int]) -> list[dict]:
    query = sa.select(
        contacts.c.id,
        contacts.c.name,
        contacts.c.job_title,
        organizations.c.name.label("organization_name"),
    ).select_from(
        contacts.outerjoin(organizations, contacts.c.organization_id == organizations.c.id)
    )
    return _in_order(conn, query, contacts, ids)


def _deals(conn: sa.Connection, ids: list[int]) -> list[dict]:
    query = sa.select(
        deals.c.id,
        deals.c.name,
        organizations.c.name.label("organization_name"),
        deals.c.stage,
        deals.c.value,
    ).select_from(deals.outerjoin(organizations, deals.c.organization_id == organizations.c.id))
    return _in_order(conn, query, deals, ids)


KINDS = (
    ("organizations", organizations, _organizations),
    ("contacts", contacts, _contacts),
    ("deals", deals, _deals),
)


def find(conn: sa.Connection, text: str) -> dict:
    """Up to 5 of each kind whose name contains text, ignoring case and any spaces before or
    after it, with the total of each. Empty or only spaces finds nothing."""
    search = text.strip().lower()
    result = {}
    for kind, table, details in KINDS:
        ids = _ranked(_names(conn, table), search) if search else []
        result[kind] = {"total": len(ids), "results": details(conn, ids[:SHOWN])}
    return result
