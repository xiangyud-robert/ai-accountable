"""The sample data: a business that sells software and services to other businesses.

build(today) returns the rows, the same every time for the same today. Every date is
counted in days from today, so a later today moves every date by the same amount.
load(conn, today) clears every table and inserts the rows, inside the caller's transaction.

Run as `python -m backend.seed` to migrate the database if needed and load the data.
`--today YYYY-MM-DD` sets the date, and `--large` adds 500 of each kind of record.
It works only on a SQLite database, so it can't replace the team's data (concern 15).
"""

import argparse
import dataclasses
import random
from datetime import date, datetime, time, timedelta

import sqlalchemy as sa

from backend import clock, db, settings, stages
from backend.tables import (
    activities,
    contacts,
    deals,
    organizations,
    stage_changes,
    status_changes,
    users,
)
from backend.teammates import TEAMMATES

# How much of the sample data each teammate added, by id: Dana 40%, Joel 25%, Nora 20% and
# Wes 15%. Uneven, as in a real team.
SHARES = dict(zip((t.id for t in TEAMMATES), (40, 25, 20, 15), strict=True))
# How often a deal's activity is logged by whoever added the deal, and how often a record
# was last changed by someone other than who added it.
LOGGED_BY_DEAL_ADDER = 0.75
CHANGED_BY_SOMEONE_ELSE = 0.2
# The tables whose rows record who added and last changed them (R17).
RECORDS = ("organizations", "contacts", "deals", "activities")

# name, industry, website, notes. The last two have no deals yet.
ORGANIZATIONS = [
    (
        "Harbor Logistics",
        "Logistics",
        "harborlogistics.example",
        "Regional freight and warehousing, about 400 trucks.",
    ),
    (
        "Brightline Retail",
        "Retail",
        "brightline.example",
        "Home goods chain with 60 stores and a growing online shop.",
    ),
    (
        "Northwind Health",
        "Healthcare",
        "northwindhealth.example",
        "Hospital group with three sites.",
    ),
    (
        "Cobalt Bank",
        "Financial services",
        "cobaltbank.example",
        "Community bank. Slow procurement, but loyal once signed.",
    ),
    ("Meridian Insurance", "Financial services", "meridian-insurance.example", None),
    (
        "Ridgeway Manufacturing",
        "Manufacturing",
        "ridgeway.example",
        "Precision parts. Two plants, one in Ohio and one in Ontario.",
    ),
    ("Fernhill Schools", "Education", "fernhill.example", "Group of eight independent schools."),
    ("Quarry & Co", "Professional services", "quarryco.example", "Accounting firm, 120 staff."),
    ("Sable Hotels", "Hospitality", "sablehotels.example", "Boutique hotels in five cities."),
    ("Atlas Freight", "Logistics", "atlasfreight.example", None),
    (
        "Kestrel Media",
        "Media",
        "kestrelmedia.example",
        "Publisher of trade magazines and podcasts.",
    ),
    (
        "Pinecrest Foods",
        "Food and drink",
        "pinecrestfoods.example",
        "Packaged foods, sold to grocery chains.",
    ),
    ("Larkspur Health", "Healthcare", "larkspurhealth.example", "Network of 14 clinics."),
    ("Juniper Software", "Software", "junipersoftware.example", "Possible partner for resale."),
    ("Oakmont Legal", "Professional services", "oakmontlegal.example", None),
]

# name, organization index (None for none), job title, status.
# The first 14 are customers, then 10 qualified, then 16 leads.
CONTACTS = [
    ("Priya Raman", 0, "Head of Operations", "customer"),
    ("Daniel Okafor", 3, "Chief Data Officer", "customer"),
    ("Marcus Bell", 1, "IT Director", "customer"),
    ("Elena Petrova", 2, "VP Clinical Systems", "customer"),
    ("Tomás Herrera", 5, "Plant Manager", "customer"),
    ("Grace Whitfield", 6, "Director of IT", "customer"),
    ("Owen Fletcher", 4, "Claims Operations Lead", "customer"),
    ("Aiko Tanaka", 8, "Revenue Manager", "customer"),
    ("Sam Whitaker", 7, "Finance Director", "customer"),
    ("Ines Duarte", 9, "Head of Engineering", "customer"),
    ("Ruth Adeyemi", 12, "Digital Lead", "customer"),
    ("Leah Morgan", 10, "Head of Content", "customer"),
    ("Hannah Lee", 11, "Supply Chain Manager", "customer"),
    ("Victor Nguyen", 0, "Chief Financial Officer", "customer"),
    ("Jonas Weber", 3, "Risk Analytics Manager", "qualified"),
    ("Chloe Martin", 1, "E-commerce Manager", "qualified"),
    ("Rafael Costa", 2, "Data Platform Lead", "qualified"),
    ("Megan O'Brien", 4, "Underwriting Director", "qualified"),
    ("Arjun Mehta", 5, "Quality Engineer", "qualified"),
    ("Sofia Rossi", 8, "Guest Experience Director", "qualified"),
    ("Ben Carter", 9, "Operations Director", "qualified"),
    ("Nadia Haddad", 10, "Product Manager", "qualified"),
    ("Lucas Schmidt", 11, "IT Manager", "qualified"),
    ("Emily Zhang", 6, "Head of Curriculum", "qualified"),
    ("Tom Becker", 0, "Fleet Manager", "lead"),
    ("Olivia Grant", 7, "Office Manager", "lead"),
    ("Ethan Brooks", 12, "Practice Manager", "lead"),
    ("Maya Patel", 13, "Head of Partnerships", "lead"),
    ("Noah Kim", 13, "Engineering Manager", "lead"),
    ("Isla Murray", 14, "Managing Partner", "lead"),
    ("Liam Walsh", 14, "IT Coordinator", "lead"),
    ("Zara Ahmed", 3, "Compliance Officer", "lead"),
    ("Felix Wagner", 5, "Procurement Lead", "lead"),
    ("Ava Thompson", 1, "Store Systems Analyst", "lead"),
    ("Kofi Mensah", 9, "Customs Lead", "lead"),
    ("Julia Novak", 4, "Agent Network Manager", "lead"),
    ("Ryan Doyle", 10, "Licensing Manager", "lead"),
    ("Mia Fischer", 11, "Marketing Manager", "lead"),
    ("Carlos Ruiz", None, "Independent consultant", "lead"),
    ("Anna Kowalski", None, "Freelance IT consultant", "lead"),
]

# The work in each deal's name, its organization and main contact, and how far it got.
# Won deals are listed newest first, about 17 days apart, so most months have a win.
WON = [
    ("quality analytics", 5, 4),
    ("risk reporting licenses", 3, 1),
    ("e-commerce integration", 1, 2),
    ("support renewal", 6, 5),
    ("data platform setup", 2, 3),
    ("revenue management pilot", 8, 7),
    ("route optimization", 0, 0),
    ("claims portal", 4, 6),
    ("finance dashboards", 7, 8),
    ("shipment tracking API", 9, 9),
    ("patient scheduling", 12, 10),
    ("content analytics", 10, 11),
    ("inventory integration", 11, 12),
    ("finance reporting", 0, 13),
    ("analytics training", 3, 1),
    ("support plan", 5, 4),
    ("POS licenses", 1, 2),
    ("staff training", 2, 3),
    ("booking analytics", 8, 7),
    ("telematics licenses", 0, 0),
]
WON_DAYS_AGO = [2 + round(i * 17.5) for i in range(len(WON))]

# work, organization, main contact, stage, days from today to the close date, probability
# set by hand (None for the stage's usual one). Three are late.
OPEN = [
    ("fraud analytics pilot", 3, 14, "new", 120, None),
    ("learning platform", 6, 23, "new", 140, None),
    ("patient portal discovery", 12, 26, "new", 95, None),
    ("shop floor dashboards", 5, 32, "new", 160, None),
    ("audience insights", 10, 36, "new", 110, None),
    ("route planning add-on", 0, 0, "qualified", 75, None),
    ("finance reporting setup", 7, 25, "qualified", -8, None),
    ("staff scheduling", 2, 16, "qualified", 60, None),
    ("loyalty data migration", 1, 15, "qualified", 85, None),
    ("demand forecasting", 11, 22, "qualified", 100, 30),
    ("claims workflow integration", 4, 17, "proposal", 30, 60),
    ("fleet analytics", 0, 0, "proposal", 45, None),
    ("data warehouse support", 3, 1, "proposal", -4, None),
    ("customs API integration", 9, 20, "proposal", 55, None),
    ("guest feedback platform", 8, 19, "proposal", 40, None),
    ("POS integration", 1, 2, "negotiation", 18, None),
    ("analytics rollout", 2, 3, "negotiation", 25, None),
    ("booking engine rollout", 8, 7, "negotiation", -12, None),
    ("support plan renewal", 5, 18, "negotiation", 35, 90),
]

# work, organization, main contact, the stage it was lost from, days ago it was lost.
LOST = [
    ("agent mobile app", 4, 35, "proposal", 24),
    ("analytics training", 10, 21, "qualified", 50),
    ("warehouse scanners", 11, 37, "new", 95),
    ("content platform licenses", 10, 11, "negotiation", 140),
    ("spa booking integration", 8, 19, "proposal", 205),
    ("driver app", 9, 34, "qualified", 270),
]

# type, description, contact index or ("deal", deal key), days ago it happened,
# follow-up days from today, done. Deal keys are (stage, work).
FOLLOW_UPS = [
    (
        "call",
        "Chase the signed order form",
        ("negotiation", "booking engine rollout"),
        16,
        -9,
        False,
    ),
    (
        "email",
        "Send revised pricing for a 3-year term",
        ("qualified", "finance reporting setup"),
        12,
        -6,
        False,
    ),
    ("call", "Confirm the data warehouse scope with IT", 1, 10, -4, False),
    (
        "note",
        "Prepare answers to the security questionnaire",
        ("proposal", "claims workflow integration"),
        7,
        -2,
        False,
    ),
    ("email", "Share the education case study", 5, 5, -1, False),
    ("call", "Kick-off call to plan the pilot", ("new", "fraud analytics pilot"), 6, 0, False),
    ("email", "Send the contract redlines", ("negotiation", "POS integration"), 4, 1, False),
    ("call", "Check the budget sign-off", 3, 3, 2, False),
    ("note", "Draft the support plan quote", ("negotiation", "support plan renewal"), 2, 4, False),
    ("call", "Intro call with the operations lead", 24, 1, 5, False),
    ("email", "Follow up on the demo", ("proposal", "customs API integration"), 1, 7, False),
    (
        "email",
        "Send the renewal terms ahead of the review",
        ("negotiation", "analytics rollout"),
        2,
        12,
        False,
    ),
    ("call", "Quarterly check-in on adoption", 13, 5, 20, False),
    ("note", "Plan the second-phase workshop", ("proposal", "fleet analytics"), 8, 30, False),
    ("call", "Book the onboarding sessions", 4, 45, -40, True),
    ("email", "Send the training schedule", 11, 35, -30, True),
    ("call", "Confirm the go-live date", 9, 30, -25, True),
    ("email", "Send the invoice details to finance", 8, 26, -20, True),
    ("note", "Write up the pilot results", ("qualified", "staff scheduling"), 20, -14, True),
    ("call", "Check how the first week went", 2, 6, -3, True),
]

# Two activities from this morning, so the dashboard's Today group has something in it.
THIS_MORNING = [
    (
        "call",
        "Walked through the fleet analytics proposal. Priya wants a phased rollout.",
        ("proposal", "fleet analytics"),
        time(9, 40),
    ),
    ("email", "Sent the onboarding checklist to Grace.", 5, time(8, 15)),
]

NOTES = [
    "Security review needed before sign-off.",
    "Budget confirmed for next quarter.",
    "Support plan looks likely. Asked for a 2-year option.",
    "{first} wants a phased rollout, starting with one region.",
    "Procurement needs three references before the next step.",
    "Legal is reviewing the data processing terms.",
    "Good fit. The team is outgrowing spreadsheets.",
    "Renewal likely, but they want a price hold.",
]
CALLS = [
    "Walked through the proposal with {first}.",
    "Intro call. {first} is looking at options for next year.",
    "Discovery call about how they report today.",
    "Talked through the implementation timeline.",
    "Checked in after the pilot. The feedback was positive.",
    "Call about pricing tiers and seat counts.",
]
EMAILS = [
    "Sent the case study {first} asked for.",
    "Sent the contract draft to {first}.",
    "Shared the onboarding plan.",
    "Sent the revised pricing.",
    "Followed up on the demo with a summary.",
    "Sent the answers to the security questionnaire.",
]
TEXTS = {"note": NOTES, "call": CALLS, "email": EMAILS}
GENERATED_ACTIVITIES = 100 - len(FOLLOW_UPS) - len(THIS_MORNING)

# For --large: made-up names, numbered so they don't repeat.
LARGE_COUNT = 500
LARGE_WORDS = [
    "Alder",
    "Birch",
    "Cedar",
    "Dunmore",
    "Elm",
    "Fairview",
    "Granite",
    "Hollis",
    "Ivy",
    "Keystone",
]
LARGE_KINDS = ["Systems", "Partners", "Group", "Industries", "Labs"]
LARGE_FIRST = [
    "Alex",
    "Jordan",
    "Casey",
    "Morgan",
    "Riley",
    "Taylor",
    "Jamie",
    "Avery",
    "Quinn",
    "Drew",
]
LARGE_LAST = [
    "Adams",
    "Baker",
    "Clarke",
    "Dixon",
    "Ellis",
    "Foster",
    "Hughes",
    "Irwin",
    "Jensen",
    "Keller",
]
LARGE_WORK = ["analytics", "integration", "licenses", "support renewal", "training"]


def _at(day: date, rng: random.Random, start: int = 9, end: int = 17) -> datetime:
    return datetime.combine(day, time(rng.randrange(start, end), rng.randrange(0, 60, 5)))


def _path(final: str, skip_qualified: bool) -> list[str]:
    """The open stages a deal went through to reach final, which may be an open stage."""
    path = list(stages.OPEN_KEYS[: stages.OPEN_KEYS.index(final) + 1])
    if skip_qualified and "qualified" in path and path[-1] != "qualified":
        path.remove("qualified")
    return path


class _Builder:
    def __init__(self, today: date):
        self.today = today
        self.rng = random.Random(2026)
        # A generator of its own, so choosing who added what leaves the records as they were.
        self.people_rng = random.Random(2028)
        self.adders: list[str] = []
        self.rows = {
            name: []
            for name in (
                "users",
                "organizations",
                "contacts",
                "deals",
                "stage_changes",
                "status_changes",
                "activities",
            )
        }
        self.deal_keys: dict[tuple[str, str], int] = {}
        self.lifetimes: dict[int, tuple[date, date]] = {}

    def day(self, offset: int) -> date:
        return self.today + timedelta(days=offset)

    def add(self, table: str, **row) -> int:
        row["id"] = len(self.rows[table]) + 1
        self.rows[table].append(row)
        return row["id"]

    def teammates(self) -> None:
        self.rows["users"] = [dataclasses.asdict(teammate) for teammate in TEAMMATES]

    def organizations(self) -> None:
        for i, (name, industry, website, notes) in enumerate(ORGANIZATIONS):
            created = datetime.combine(self.day(-420 + i), time(10, 0))
            self.add(
                "organizations",
                name=name,
                industry=industry,
                website=f"https://{website}",
                notes=notes,
                created_at=created,
                updated_at=created,
            )

    def contacts(self) -> None:
        for i, (name, org, title, status) in enumerate(CONTACTS):
            first = name.split()[0].lower()
            domain = ORGANIZATIONS[org][2] if org is not None else "mail.example"
            created = datetime.combine(self.day(-410 + i), time(11, 0))
            self.add(
                "contacts",
                name=name,
                email=f"{first}@{domain}",
                phone=f"+1 555 01{i:02d}",
                job_title=title,
                organization_id=org + 1 if org is not None else None,
                # Customers start out qualified, and become customers on their first win below.
                status="qualified" if status == "customer" else status,
                created_at=created,
                updated_at=created,
            )

    def value(self) -> int:
        return self.rng.randrange(10, 301) * 500

    def deal(
        self, work, org, contact, stage, close, probability, path, last_change, added_by=None
    ) -> int:
        """Adds a deal and a stage history that ends on last_change, spread over the weeks
        before. If added_by is given, the deal was added no later than that day."""
        changes = []
        when = last_change
        for to_stage in reversed(path):
            changes.append((to_stage, when))
            when -= timedelta(days=self.rng.randrange(7, 22), hours=self.rng.randrange(0, 5))
        changes.reverse()
        if added_by is not None and changes[0][1].date() > added_by:
            changes[0] = (
                changes[0][0],
                _at(added_by - timedelta(days=self.rng.randrange(0, 21)), self.rng),
            )
        name = f"{ORGANIZATIONS[org][0]} {work}"
        deal_id = self.add(
            "deals",
            name=name,
            organization_id=org + 1,
            contact_id=contact + 1,
            stage=stage,
            value=self.value(),
            probability=probability if probability is not None else stages.usual_probability(stage),
            close_date=close,
            position=sum(1 for d in self.rows["deals"] if d["stage"] == stage),
            created_at=changes[0][1],
            updated_at=changes[-1][1],
        )
        previous = None
        for to_stage, when in changes:
            self.add(
                "stage_changes",
                deal_id=deal_id,
                from_stage=previous,
                to_stage=to_stage,
                changed_at=when,
            )
            previous = to_stage
        self.deal_keys[(stage, work)] = deal_id
        end = close if not stages.is_open(stage) else self.today
        self.lifetimes[deal_id] = (changes[0][1].date(), end)
        return deal_id

    def deals(self) -> None:
        for i, (work, org, contact, stage, close_in, probability) in enumerate(OPEN):
            last = _at(self.day(-self.rng.randrange(1, 21)), self.rng)
            path = _path(stage, i % 3 == 1)
            # Added at least 40 days ago, before any activity logged on it.
            self.deal(
                work,
                org,
                contact,
                stage,
                self.day(close_in),
                probability,
                path,
                last,
                self.day(-40),
            )
        for i, (work, org, contact) in enumerate(WON):
            close = self.day(-WON_DAYS_AGO[i])
            path = _path("negotiation", i % 4 == 2) + ["won"]
            self.deal(work, org, contact, "won", close, None, path, _at(close, self.rng, 10, 17))
        for work, org, contact, lost_from, days_ago in LOST:
            close = self.day(-days_ago)
            path = _path(lost_from, False) + ["lost"]
            self.deal(work, org, contact, "lost", close, None, path, _at(close, self.rng, 10, 17))

    def customers(self) -> None:
        """Each customer became one when their first deal was won (R3)."""
        won_at = {
            c["deal_id"]: c["changed_at"]
            for c in self.rows["stage_changes"]
            if c["to_stage"] == "won"
        }
        for contact in self.rows["contacts"]:
            if CONTACTS[contact["id"] - 1][3] != "customer":
                continue
            wins = [
                d
                for d in self.rows["deals"]
                if d["contact_id"] == contact["id"] and d["stage"] == "won"
            ]
            first = min(wins, key=lambda d: won_at[d["id"]])
            when = won_at[first["id"]]
            contact["status"] = "customer"
            contact["updated_at"] = when
            self.add(
                "status_changes",
                contact_id=contact["id"],
                from_status="qualified",
                to_status="customer",
                won_deal_id=first["id"],
                changed_at=when,
            )

    def first_name(self, contact_id: int | None) -> str:
        return CONTACTS[contact_id - 1][0].split()[0] if contact_id else "the team"

    def activity(self, kind, description, target, occurred, follow_up=None, done=False) -> None:
        on_deal = isinstance(target, int) and target < 0
        self.add(
            "activities",
            type=kind,
            contact_id=None if on_deal else target,
            deal_id=-target if on_deal else None,
            description=description,
            occurred_at=occurred,
            follow_up_date=follow_up,
            follow_up_done=done,
            created_at=occurred,
            updated_at=occurred,
        )

    def target(self, target) -> int:
        """A contact index becomes its id, and a deal key becomes minus the deal's id."""
        if isinstance(target, tuple):
            return -self.deal_keys[target]
        return target + 1

    def activities(self) -> None:
        for kind, description, target, days_ago, follow_up_in, done in FOLLOW_UPS:
            occurred = _at(self.day(-days_ago), self.rng)
            self.activity(
                kind, description, self.target(target), occurred, self.day(follow_up_in), done
            )
        for kind, description, target, at in THIS_MORNING:
            self.activity(kind, description, self.target(target), datetime.combine(self.today, at))
        for i in range(GENERATED_ACTIVITIES):
            # Squaring a random number puts more of them in recent weeks.
            days_ago = 1 + int(self.rng.random() ** 2 * 360)
            day = self.day(-days_ago)
            kind = self.rng.choice(("note", "call", "email"))
            template = self.rng.choice(TEXTS[kind])
            alive = [d for d, (start, end) in self.lifetimes.items() if start <= day <= end]
            if i % 2 == 0 and alive:
                deal_id = self.rng.choice(alive)
                contact_id = self.rows["deals"][deal_id - 1]["contact_id"]
                target = -deal_id
            else:
                contact_id = self.rng.randrange(1, len(CONTACTS) + 1)
                target = contact_id
            text = template.format(first=self.first_name(contact_id))
            self.activity(kind, text, target, _at(day, self.rng))

    def people(self, start: dict[str, int]) -> None:
        """Who added and last changed each record from start on, as in sample-data.md."""
        for table in RECORDS:
            for row in self.rows[table][start.get(table, 0) :]:
                row["created_by"] = self.added_by(table, row)
                row["updated_by"] = self.last_changed_by(row)
        # A won deal making its contact a customer is a change to the contact by whoever
        # moved the deal (R17).
        for change in self.rows["status_changes"][start.get("status_changes", 0) :]:
            contact = self.rows["contacts"][change["contact_id"] - 1]
            contact["updated_by"] = self.rows["deals"][change["won_deal_id"] - 1]["updated_by"]

    def next_adder(self) -> str:
        """Dealt from a shuffled deck of 20, one card for each 5% of a teammate's share, so
        each kind of record comes close to the shares."""
        if not self.adders:
            self.adders = [adder for adder, share in SHARES.items() for _ in range(share // 5)]
            self.people_rng.shuffle(self.adders)
        return self.adders.pop()

    def someone_other_than(self, teammate_id: str) -> str:
        others = {other: share for other, share in SHARES.items() if other != teammate_id}
        return self.people_rng.choices(list(others), list(others.values()))[0]

    def added_by(self, table: str, row: dict) -> str:
        on_deal = table == "activities" and row["deal_id"] is not None
        if on_deal and self.people_rng.random() < LOGGED_BY_DEAL_ADDER:
            return self.rows["deals"][row["deal_id"] - 1]["created_by"]
        return self.next_adder()

    def last_changed_by(self, row: dict) -> str:
        """About one record in five was last changed by someone else. One that hadn't been
        changed since it was added gets a later change, so it shows as changed."""
        adder = row["created_by"]
        if self.people_rng.random() >= CHANGED_BY_SOMEONE_ELSE:
            return adder
        if row["updated_at"] == row["created_at"]:
            changed = self.later_change(row["created_at"])
            if changed is None:
                return adder
            row["updated_at"] = changed
        return self.someone_other_than(adder)

    def later_change(self, added: datetime) -> datetime | None:
        """A time on a day after added and before today, or None if there's no such day."""
        days = (self.today - added.date()).days - 1
        if days < 1:
            return None
        day = added.date() + timedelta(days=self.people_rng.randrange(1, days + 1))
        return _at(day, self.people_rng)

    def large(self) -> None:
        """500 more of each kind of record, for speed checks. A separate random seed keeps
        the usual sample data the same."""
        rng = random.Random(2027)
        base = {name: len(rows) for name, rows in self.rows.items()}
        for n in range(LARGE_COUNT):
            name = f"{LARGE_WORDS[n % 10]} {LARGE_KINDS[n // 10 % 5]} {n // 50 + 1}"
            created = datetime.combine(self.day(-400), time(9, 0))
            self.add(
                "organizations",
                name=name,
                industry="Software",
                website=None,
                notes=None,
                created_at=created,
                updated_at=created,
            )
        for n in range(LARGE_COUNT):
            status = ("lead", "qualified", "customer")[n % 3]
            created = datetime.combine(self.day(-390), time(9, 0))
            self.add(
                "contacts",
                name=f"{LARGE_FIRST[n % 10]} {LARGE_LAST[n // 10 % 10]} {n // 100 + 1}",
                email=None,
                phone=None,
                job_title="Manager",
                organization_id=base["organizations"] + n + 1,
                status=status,
                created_at=created,
                updated_at=created,
            )
        for n in range(LARGE_COUNT):
            stage = stages.KEYS[n % 6]
            # Every third large contact is a customer, and won deals go to one of them.
            contact = n // 3 * 3 + 2 if stage == "won" else n
            close = self.day(
                rng.randrange(-330, -1) if stage in stages.CLOSED_KEYS else rng.randrange(-10, 150)
            )
            added = datetime.combine(self.day(-360), time(9, 0))
            org_name = self.rows["organizations"][base["organizations"] + n]["name"]
            deal_id = self.add(
                "deals",
                name=f"{org_name} {LARGE_WORK[n % 5]}",
                organization_id=base["organizations"] + n + 1,
                contact_id=base["contacts"] + min(contact, LARGE_COUNT - 1) + 1,
                stage=stage,
                value=rng.randrange(10, 301) * 500,
                probability=stages.usual_probability(stage),
                close_date=close,
                position=sum(1 for d in self.rows["deals"] if d["stage"] == stage),
                created_at=added,
                updated_at=added,
            )
            self.add(
                "stage_changes", deal_id=deal_id, from_stage=None, to_stage=stage, changed_at=added
            )
        for n in range(LARGE_COUNT):
            occurred = _at(self.day(-rng.randrange(1, 360)), rng)
            on_deal = n % 2 == 0
            target = -(base["deals"] + n + 1) if on_deal else base["contacts"] + n + 1
            self.activity(
                rng.choice(("note", "call", "email")),
                "Checked in about next steps.",
                target,
                occurred,
            )
        # Drawn after the usual records' people, so theirs stay the same.
        self.people(base)


def build(today: date, large: bool = False) -> dict[str, list[dict]]:
    """The sample data's rows for each table, the same every time for the same today."""
    builder = _Builder(today)
    builder.teammates()
    builder.organizations()
    builder.contacts()
    builder.deals()
    builder.customers()
    builder.activities()
    builder.people({})
    if large:
        builder.large()
    return builder.rows


# Parents first. They're inserted in this order and deleted in reverse, so nothing is left
# pointing at a missing row.
TABLES = [users, organizations, contacts, deals, stage_changes, status_changes, activities]


def _next_id_resets() -> list[sa.Select]:
    """For Postgres. The rows go in with their ids, which leaves each table's id sequence at
    1, so the first record anyone added would clash with one already there (risk 2). Each of
    these moves a sequence on to just past its table's highest id."""
    resets = []
    for table in TABLES:
        if isinstance(table.c.id.type, sa.Integer):
            next_id = sa.select(sa.func.coalesce(sa.func.max(table.c.id), 0) + 1)
            # The table's name is a quoted_name, which needs its type spelled out.
            name = sa.literal(table.name, sa.Text)
            sequence = sa.func.pg_get_serial_sequence(name, sa.literal("id", sa.Text))
            resets.append(sa.select(sa.func.setval(sequence, next_id.scalar_subquery(), False)))
    return resets


def load(conn: sa.Connection, today: date, large: bool = False) -> dict[str, int]:
    """Replaces all the data with the sample data, inside the caller's transaction."""
    rows = build(today, large)
    # This morning's activities can't be later than now, if loaded early in the day.
    now = clock.now()
    for activity in rows["activities"]:
        if activity["occurred_at"] > now:
            activity["occurred_at"] = activity["created_at"] = activity["updated_at"] = now
    for table in reversed(TABLES):
        conn.execute(table.delete())
    for table in TABLES:
        if rows[table.name]:
            conn.execute(table.insert(), rows[table.name])
    if conn.dialect.name == "postgresql":
        for reset in _next_id_resets():
            conn.execute(reset)
    return {name: len(table_rows) for name, table_rows in rows.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description="Replace all the data with fresh sample data.")
    parser.add_argument(
        "--today", type=date.fromisoformat, help="the date to count from, as YYYY-MM-DD"
    )
    parser.add_argument("--large", action="store_true", help="add 500 of each kind of record")
    args = parser.parse_args()
    today = args.today or clock.today()

    if not db.is_sqlite(settings.database_url()):
        raise SystemExit(
            "npm run seed works only on a SQLite database on this computer, since it replaces "
            "all the data. DATABASE_URL names another kind of database, so nothing was changed."
        )
    engine = db.make_engine()
    db.migrate(engine)
    with db.transaction(engine) as conn:
        counts = load(conn, today, args.large)
    engine.dispose()
    print(
        f"Loaded the sample data, dated from {today:%b} {today.day}, {today.year}: "
        f"{counts['organizations']} organizations, {counts['contacts']} contacts, "
        f"{counts['deals']} deals and {counts['activities']} activities."
    )
    print("If Accountable is open, refresh the page to see it.")


if __name__ == "__main__":
    main()
