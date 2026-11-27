import itertools
import sys
import uuid
from collections import Counter
from datetime import date, datetime, timedelta
from unittest.mock import MagicMock

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from backend import seed, stages, tables
from backend.services import dashboard
from backend.tables import activities, organizations, users
from backend.teammates import TEAMMATES
from backend.tests.conftest import NOW, TODAY

# Who added the sample data, as sample-data.md has it.
SHARES = {"Dana Holt": 0.40, "Joel Abara": 0.25, "Nora Lindqvist": 0.20, "Wes Moreno": 0.15}
NAMES = {teammate.id: teammate.display_name for teammate in TEAMMATES}
KINDS = ("organizations", "contacts", "deals", "activities")


@pytest.fixture(scope="module")
def rows():
    return seed.build(TODAY)


@pytest.fixture(scope="module")
def large_rows():
    return seed.build(TODAY, large=True)


def _records(rows, start=None) -> list[dict]:
    """Every organization, contact, deal and activity, from start on for each kind."""
    start = start or {}
    return [row for kind in KINDS for row in rows[kind][start.get(kind, 0) :]]


def _assert_about_the_shares(records: list[dict], within: float) -> None:
    added = Counter(NAMES[record["created_by"]] for record in records)
    for name, share in SHARES.items():
        assert added[name] / len(records) == pytest.approx(share, abs=within), name


def _changed_by_someone_else(records: list[dict]) -> float:
    return sum(r["updated_by"] != r["created_by"] for r in records) / len(records)


def _logged_by_whoever_added_the_deal(rows, start=None) -> float:
    added_by = {deal["id"]: deal["created_by"] for deal in rows["deals"]}
    start = start or {}
    on_deals = [a for a in rows["activities"][start.get("activities", 0) :] if a["deal_id"]]
    return sum(a["created_by"] == added_by[a["deal_id"]] for a in on_deals) / len(on_deals)


def test_the_counts_by_kind(rows):
    assert {name: len(table) for name, table in rows.items()} == {
        "organizations": 15,
        "contacts": 40,
        "deals": 45,
        "activities": 100,
        "stage_changes": sum(1 for _ in rows["stage_changes"]),
        "status_changes": 14,
        "users": 4,
    }


def test_the_counts_by_stage_and_status(rows):
    assert Counter(d["stage"] for d in rows["deals"]) == {
        "new": 5,
        "qualified": 5,
        "proposal": 5,
        "negotiation": 4,
        "won": 20,
        "lost": 6,
    }
    assert Counter(c["status"] for c in rows["contacts"]) == {
        "lead": 16,
        "qualified": 10,
        "customer": 14,
    }


def test_two_organizations_have_no_deals_and_two_contacts_no_organization(rows):
    with_deals = {d["organization_id"] for d in rows["deals"]}
    assert len([o for o in rows["organizations"] if o["id"] not in with_deals]) == 2
    assert len([c for c in rows["contacts"] if c["organization_id"] is None]) == 2


def test_values_are_in_range_and_in_steps_of_500(rows):
    for deal in rows["deals"]:
        assert 5_000 <= deal["value"] <= 150_000
        assert deal["value"] % 500 == 0


def test_three_open_deals_are_late(rows):
    late = [d for d in rows["deals"] if stages.is_open(d["stage"]) and d["close_date"] < TODAY]
    assert len(late) == 3


def test_open_deals_close_in_the_months_ahead_unless_late(rows):
    future = [d for d in rows["deals"] if stages.is_open(d["stage"]) and d["close_date"] >= TODAY]
    assert len(future) == 16


def test_the_follow_up_spread(rows):
    follow_ups = [a for a in rows["activities"] if a["follow_up_date"] is not None]
    week = TODAY + timedelta(days=7)
    spread = Counter(
        "done"
        if a["follow_up_done"]
        else "overdue"
        if a["follow_up_date"] < TODAY
        else "soon"
        if a["follow_up_date"] <= week
        else "later"
        for a in follow_ups
    )
    assert spread == {"overdue": 5, "soon": 6, "later": 3, "done": 6}


def test_activities_are_over_the_past_12_months_and_more_of_them_recent(rows):
    now = datetime.combine(TODAY, datetime.min.time()) + timedelta(hours=12)
    ages = [(now - a["occurred_at"]).days for a in rows["activities"]]
    assert all(0 <= age <= 365 for age in ages)
    assert sum(age <= 90 for age in ages) > sum(age > 270 for age in ages) * 2
    assert {a["type"] for a in rows["activities"]} == {"note", "call", "email"}
    on_deals = sum(a["deal_id"] is not None for a in rows["activities"])
    assert 30 <= on_deals <= 70


def test_every_activity_belongs_to_exactly_one_record(rows):
    for activity in rows["activities"]:
        assert (activity["contact_id"] is None) != (activity["deal_id"] is None)


def test_activities_on_a_deal_come_after_it_was_added(rows):
    added = {d["id"]: d["created_at"] for d in rows["deals"]}
    for activity in rows["activities"]:
        if activity["deal_id"] is not None:
            assert activity["occurred_at"] >= added[activity["deal_id"]]


def test_wins_in_at_least_10_of_the_last_12_months(rows):
    months = set(dashboard.last_12_months(TODAY))
    won = {f"{d['close_date']:%Y-%m}" for d in rows["deals"] if d["stage"] == "won"}
    assert len(months & won) >= 10


def test_wins_cover_10_months_whatever_the_date():
    for offset in range(0, 366, 7):
        today = date(2026, 1, 1) + timedelta(days=offset)
        months = set(dashboard.last_12_months(today))
        won = {
            f"{d['close_date']:%Y-%m}" for d in seed.build(today)["deals"] if d["stage"] == "won"
        }
        assert len(months & won) >= 10, today


def test_losses_from_at_least_three_stages(rows):
    lost_ids = {d["id"] for d in rows["deals"] if d["stage"] == "lost"}
    lost_from = {
        c["from_stage"]
        for c in rows["stage_changes"]
        if c["deal_id"] in lost_ids and c["to_stage"] == "lost"
    }
    assert len(lost_from) >= 3


def test_every_main_contact_of_a_won_deal_is_a_customer(rows):
    status = {c["id"]: c["status"] for c in rows["contacts"]}
    for deal in rows["deals"]:
        if deal["stage"] == "won":
            assert status[deal["contact_id"]] == "customer"


def test_each_customer_became_one_on_their_first_win(rows):
    won_at = {
        c["deal_id"]: c["changed_at"] for c in rows["stage_changes"] if c["to_stage"] == "won"
    }
    customers = {c["id"] for c in rows["contacts"] if c["status"] == "customer"}
    assert {s["contact_id"] for s in rows["status_changes"]} == customers
    for change in rows["status_changes"]:
        wins = [
            d["id"]
            for d in rows["deals"]
            if d["contact_id"] == change["contact_id"] and d["stage"] == "won"
        ]
        assert change["won_deal_id"] == min(wins, key=lambda deal_id: won_at[deal_id])
        assert change["changed_at"] == won_at[change["won_deal_id"]]


def test_stage_histories_fit_each_deal(rows):
    now = datetime.combine(TODAY, datetime.min.time()) + timedelta(hours=12)
    for deal in rows["deals"]:
        history = [c for c in rows["stage_changes"] if c["deal_id"] == deal["id"]]
        assert history[0]["from_stage"] is None
        assert history[-1]["to_stage"] == deal["stage"]
        for before, after in itertools.pairwise(history):
            assert after["from_stage"] == before["to_stage"]
            assert after["changed_at"] > before["changed_at"]
        assert history[-1]["changed_at"] <= now
        if not stages.is_open(deal["stage"]):
            assert history[-1]["changed_at"].date() == deal["close_date"]


def test_positions_number_each_column_from_0(rows):
    for stage in stages.KEYS:
        positions = [d["position"] for d in rows["deals"] if d["stage"] == stage]
        assert positions == list(range(len(positions)))


def test_two_loads_with_the_same_today_give_the_same_rows(rows):
    assert seed.build(TODAY) == rows


def test_a_later_today_moves_every_date_by_the_same_number_of_days(rows):
    later = seed.build(TODAY + timedelta(days=40))
    shift = timedelta(days=40)
    for name, table in rows.items():
        for before, after in zip(table, later[name]):
            for key, value in before.items():
                if isinstance(value, (date, datetime)):
                    assert after[key] == value + shift, (name, key)
                else:
                    assert after[key] == value, (name, key)


def test_loading_clears_the_data_that_was_there(make, conn):
    make.org(name="Made before the reset")
    counts = seed.load(conn, TODAY)
    names = conn.execute(sa.select(organizations.c.name)).scalars().all()
    assert "Made before the reset" not in names
    assert len(names) == counts["organizations"] == 15
    assert conn.execute(sa.select(sa.func.count()).select_from(activities)).scalar() == 100


def test_this_morning_is_never_later_than_now(monkeypatch, conn):
    monkeypatch.setenv("ACCOUNTABLE_TODAY", "")
    from backend import clock

    seed.load(conn, clock.today())
    latest = conn.execute(sa.select(sa.func.max(activities.c.occurred_at))).scalar()
    assert latest <= clock.now()


def test_large_adds_500_of_each_kind():
    counts = {name: len(table) for name, table in seed.build(TODAY, large=True).items()}
    assert (counts["organizations"], counts["contacts"], counts["deals"], counts["activities"]) == (
        515,
        540,
        545,
        600,
    )


def test_names_are_unique(rows):
    for table in ("organizations", "contacts", "deals"):
        names = [r["name"] for r in rows[table]]
        assert len(names) == len(set(names)), table


def test_the_four_teammates_have_example_emails_and_ids_no_real_user_can_have():
    assert [teammate.display_name for teammate in TEAMMATES] == list(SHARES)
    for teammate in TEAMMATES:
        assert teammate.email == teammate.display_name.lower().replace(" ", ".") + "@example.com"
        # Supabase's ids are random, so one starting with 12 zeros can't be anyone's.
        assert uuid.UUID(teammate.id).hex.startswith("0" * 12)


def test_loading_puts_the_teammates_in_users(conn):
    conn.execute(users.delete())  # The tests' template database already has them.
    seed.load(conn, TODAY)
    loaded = conn.execute(sa.select(users.c.id, users.c.email, users.c.display_name)).all()
    assert sorted(loaded) == sorted((t.id, t.email, t.display_name) for t in TEAMMATES)


def test_no_contact_has_a_teammates_name(large_rows):
    contact_names = {contact["name"] for contact in large_rows["contacts"]}
    assert contact_names.isdisjoint(NAMES.values())


def test_every_record_was_added_by_a_teammate_in_about_the_specs_shares(rows):
    records = _records(rows)
    assert len(records) == 200
    for record in records:
        assert record["created_by"] in NAMES and record["updated_by"] in NAMES
    _assert_about_the_shares(records, within=0.03)
    # Each kind on its own comes close too, so every screen looks like the same team's.
    for kind in KINDS:
        _assert_about_the_shares(rows[kind], within=0.1)


def test_a_deals_activities_are_mostly_logged_by_whoever_added_the_deal(rows):
    assert _logged_by_whoever_added_the_deal(rows) >= 0.7


def test_about_one_record_in_five_was_last_changed_by_someone_else(rows):
    assert _changed_by_someone_else(_records(rows)) == pytest.approx(0.2, abs=0.05)


def test_a_record_someone_else_changed_was_changed_after_it_was_added(rows):
    """So its page shows who last changed it (R17)."""
    for record in _records(rows):
        assert record["created_at"] <= record["updated_at"] <= NOW
        if record["updated_by"] != record["created_by"]:
            assert record["updated_at"] > record["created_at"]


def test_a_customer_was_last_changed_by_whoever_won_their_first_deal(rows):
    """R17: a won deal making its contact a customer is a change by whoever moved the deal."""
    contacts = {contact["id"]: contact for contact in rows["contacts"]}
    deals = {deal["id"]: deal for deal in rows["deals"]}
    for change in rows["status_changes"]:
        contact = contacts[change["contact_id"]]
        assert contact["updated_by"] == deals[change["won_deal_id"]]["updated_by"]


def test_who_added_and_changed_each_record_is_the_same_every_time(rows):
    def people(rows):
        return [(r["id"], r["created_by"], r["updated_by"]) for r in _records(rows)]

    assert people(seed.build(TODAY)) == people(rows)
    assert people(seed.build(TODAY + timedelta(days=100))) == people(rows)


def test_large_spreads_its_records_across_the_four_the_same_way(rows, large_rows):
    start = {name: len(table) for name, table in rows.items()}
    records = _records(large_rows, start)
    assert len(records) == 2000
    _assert_about_the_shares(records, within=0.02)
    assert _changed_by_someone_else(records) == pytest.approx(0.2, abs=0.03)
    assert _logged_by_whoever_added_the_deal(large_rows, start) >= 0.7


def test_large_leaves_the_usual_records_as_they_are(rows, large_rows):
    for name, table in rows.items():
        assert large_rows[name][: len(table)] == table, name


def _postgres_sql(statement) -> str:
    return str(
        statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
    )


def test_on_postgres_loading_moves_each_id_sequence_past_the_highest_id():
    """Risk 2: the rows go in with their ids, so each sequence would still be at 1, and the
    first record anyone added would clash. Checked without connecting to Postgres."""
    conn = MagicMock()
    conn.dialect = postgresql.dialect()
    seed.load(conn, TODAY)
    statements = [call.args[0] for call in conn.execute.call_args_list]
    last_insert = max(i for i, s in enumerate(statements) if isinstance(s, sa.Insert))
    resets = [_postgres_sql(statement) for statement in statements[last_insert + 1 :]]
    numbered = [
        table.name
        for table in tables.metadata.sorted_tables
        if isinstance(table.c.id.type, sa.Integer)
    ]
    assert len(resets) == len(numbered) == 6
    for name in numbered:
        next_id = f"setval(pg_get_serial_sequence('{name}', 'id'), (SELECT coalesce(max({name}.id), 0) + 1"
        assert sum(next_id in sql and sql.endswith("false) AS setval_1") for sql in resets) == 1, (
            name
        )


def test_npm_run_seed_refuses_a_database_that_isnt_sqlite(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://postgres:hunter2@127.0.0.1:9/postgres")
    monkeypatch.setattr(sys, "argv", ["seed"])
    with pytest.raises(SystemExit) as refused:
        seed.main()
    message = str(refused.value)
    assert message.startswith("npm run seed works only on a SQLite database on this computer")
    assert "nothing was changed" in message
    assert "hunter2" not in message


def test_npm_run_seed_loads_a_sqlite_database(monkeypatch, capsys, engine):
    monkeypatch.setattr(sys, "argv", ["seed", "--today", TODAY.isoformat()])
    seed.main()
    assert "Loaded the sample data, dated from Jun 15, 2026: 15 organizations" in (
        capsys.readouterr().out
    )
    with engine.connect() as conn:
        assert conn.execute(sa.select(sa.func.count()).select_from(users)).scalar() == 4
