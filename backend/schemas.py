"""Pydantic models for every request and response, with the field rules from the data model.

Every field of a patch model has a default, and the routers dump the model with exclude_unset,
so a PATCH changes only the fields it sends. A field that can be emptied defaults to None. One
that can't defaults to MISSING, so it can be left out, but sent as null it fails its type check.
"""

import re
from datetime import date, datetime
from typing import Annotated, Literal, LiteralString

from pydantic import (
    MISSING,
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
)
from pydantic_core import PydanticCustomError

Status = Literal["lead", "qualified", "customer"]
StageKey = Literal["new", "qualified", "proposal", "negotiation", "won", "lost"]
ActivityType = Literal["note", "call", "email"]

# The message for each field when its value is missing or the wrong kind. Rules with
# their own wording raise PydanticCustomError, and main.py uses that message instead.
MESSAGES: dict[str, LiteralString] = {
    "name": "Enter a name.",
    "email": "Enter an email address like name@example.com.",
    "website": "Enter a website address, such as example.com.",
    "status": "Choose lead, qualified or customer.",
    "stage": "Choose a stage.",
    "value": "Enter a value from $0 to $100,000,000.",
    "probability": "Enter a probability from 0 to 100.",
    "close_date": "Enter a close date.",
    "type": "Choose note, call or email.",
    "description": "Enter a description.",
    "occurred_at": "Enter the date and time it happened.",
    "follow_up_date": "Enter a follow-up date, or leave it empty.",
    "follow_up_done": "Choose done or not done.",
    "organization_id": "Choose an organization from the list.",
    "contact_id": "Choose a contact from the list.",
    "deal_id": "Choose a deal from the list.",
    "index": "Enter a position of 0 or more.",
}

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SCHEME = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")
WEB_SCHEME = re.compile(r"^https?://", re.IGNORECASE)
WEBSITE_LENGTH = 300

# The largest id an Integer column holds, on SQLite and on Postgres. A bigger one can't be a record's.
MAX_ID = 2**31 - 1


def _blank_to_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _check_email(value: str | None) -> str | None:
    if value is not None and not EMAIL.match(value):
        raise PydanticCustomError("accountable", MESSAGES["email"])
    return value


def _check_website(value: str | None) -> str | None:
    """Adds https:// if no scheme is given. Only web addresses are kept, since the website
    becomes a link. The length is checked with the scheme added, as it's saved."""
    if value is None:
        return None
    if not SCHEME.match(value):
        value = f"https://{value}"
    elif not WEB_SCHEME.match(value):
        raise PydanticCustomError("accountable", MESSAGES["website"])
    if len(value) > WEBSITE_LENGTH:
        raise PydanticCustomError(
            "accountable",
            "Keep this to {max_length} characters or fewer.",
            {"max_length": f"{WEBSITE_LENGTH:,}"},
        )
    return value


def _local_time(value: datetime) -> datetime:
    # Times are kept as local time with no zone. A time sent with a zone is converted.
    if value.tzinfo is not None:
        value = value.astimezone().replace(tzinfo=None)
    return value.replace(microsecond=0)


def _required(max_length: int) -> StringConstraints:
    # Text that must be given. It's trimmed first, so only spaces counts as empty.
    return StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)


BlankToNone = BeforeValidator(_blank_to_none)

OrgName = Annotated[str, _required(120)]
ContactName = Annotated[str, _required(120)]
DealName = Annotated[str, _required(160)]
Description = Annotated[str, _required(5000)]
# Optional text's limit goes on the str alone: on the whole union it would apply to None too.
Notes = Annotated[Annotated[str, StringConstraints(max_length=5000)] | None, BlankToNone]
Industry = Annotated[Annotated[str, StringConstraints(max_length=80)] | None, BlankToNone]
Phone = Annotated[Annotated[str, StringConstraints(max_length=40)] | None, BlankToNone]
JobTitle = Annotated[Annotated[str, StringConstraints(max_length=120)] | None, BlankToNone]
Email = Annotated[
    Annotated[str, StringConstraints(max_length=254)] | None,
    BlankToNone,
    AfterValidator(_check_email),
]
Website = Annotated[str | None, BlankToNone, AfterValidator(_check_website)]
Money = Annotated[int, Field(ge=0, le=100_000_000)]
Percent = Annotated[int, Field(ge=0, le=100)]
OptionalId = Annotated[Annotated[int, Field(le=MAX_ID)] | None, BlankToNone]
OptionalDate = Annotated[date | None, BlankToNone]
LocalTime = Annotated[datetime, AfterValidator(_local_time)]


class Request(BaseModel):
    model_config = ConfigDict(extra="forbid")


# Requests


class OrganizationIn(Request):
    name: OrgName
    website: Website = None
    industry: Industry = None
    notes: Notes = None


class OrganizationPatch(Request):
    name: OrgName | MISSING = MISSING
    website: Website = None
    industry: Industry = None
    notes: Notes = None


class ContactIn(Request):
    name: ContactName
    email: Email = None
    phone: Phone = None
    job_title: JobTitle = None
    organization_id: OptionalId = None
    status: Status = "lead"


class ContactPatch(Request):
    name: ContactName | MISSING = MISSING
    email: Email = None
    phone: Phone = None
    job_title: JobTitle = None
    organization_id: OptionalId = None
    status: Status | MISSING = MISSING


class DealIn(Request):
    name: DealName
    organization_id: OptionalId = None
    contact_id: OptionalId = None
    stage: StageKey = "new"
    value: Money
    probability: Percent | None = None
    close_date: date | None = None


class DealPatch(Request):
    name: DealName | MISSING = MISSING
    organization_id: OptionalId = None
    contact_id: OptionalId = None
    stage: StageKey | MISSING = MISSING
    value: Money | MISSING = MISSING
    probability: Percent | MISSING = MISSING
    close_date: date | MISSING = MISSING


class DealMove(Request):
    stage: StageKey
    index: Annotated[int, Field(ge=0)]


class ActivityIn(Request):
    type: ActivityType
    contact_id: OptionalId = None
    deal_id: OptionalId = None
    description: Description
    occurred_at: LocalTime | None = None
    follow_up_date: OptionalDate = None
    follow_up_done: bool = False


class ActivityPatch(Request):
    type: ActivityType | MISSING = MISSING
    description: Description | MISSING = MISSING
    occurred_at: LocalTime | MISSING = MISSING
    follow_up_date: OptionalDate = None
    follow_up_done: bool | MISSING = MISSING


# Responses


class StageOut(BaseModel):
    key: StageKey
    name: str
    order: int
    probability: int
    open: bool


class Ref(BaseModel):
    id: int
    name: str


class OrganizationRow(BaseModel):
    id: int
    name: str
    website: str | None
    industry: str | None
    notes: str | None
    contact_count: int
    deal_count: int
    open_deal_count: int
    open_value: int
    created_at: datetime
    updated_at: datetime


class ContactRow(BaseModel):
    id: int
    name: str
    email: str | None
    phone: str | None
    job_title: str | None
    organization_id: int | None
    organization_name: str | None
    status: Status
    deal_count: int
    activity_count: int
    created_at: datetime
    updated_at: datetime


class DealRow(BaseModel):
    id: int
    name: str
    organization_id: int | None
    organization_name: str | None
    contact_id: int | None
    contact_name: str | None
    stage: StageKey
    value: int
    probability: int
    expected: float
    close_date: date
    position: int
    late: bool
    activity_count: int
    created_at: datetime
    updated_at: datetime


class TimelineEntry(BaseModel):
    """One activity, stage change or status change, as shown in a timeline."""

    key: str
    kind: Literal["activity", "stage_change", "status_change"]
    id: int
    at: datetime
    text: str
    record: Literal["contact", "deal"]  # the record it belongs to
    type: ActivityType | None = None
    follow_up_date: date | None = None
    follow_up_done: bool | None = None
    follow_up_overdue: bool | None = None
    from_value: str | None = None
    to_value: str | None = None
    contact_id: int | None = None
    contact_name: str | None = None
    deal_id: int | None = None
    deal_name: str | None = None


class OrganizationDetail(OrganizationRow):
    contacts: list[ContactRow]
    deals: list[DealRow]
    won_value: int


class ContactDetail(ContactRow):
    organization: Ref | None
    deals: list[DealRow]
    timeline: list[TimelineEntry]


class DealDetail(DealRow):
    timeline: list[TimelineEntry]


class ActivityOut(BaseModel):
    id: int
    type: ActivityType
    contact_id: int | None
    deal_id: int | None
    description: str
    occurred_at: datetime
    follow_up_date: date | None
    follow_up_done: bool
    created_at: datetime
    updated_at: datetime


class MonthFigures(BaseModel):
    month: str  # YYYY-MM
    revenue: int
    count: int


class OpenFigures(BaseModel):
    count: int
    value: int
    expected: float


class StageFigures(BaseModel):
    stage: StageKey
    count: int
    value: int
    expected: float


class FunnelStage(BaseModel):
    stage: StageKey
    count: int
    value: int


class Totals(BaseModel):
    count: int
    value: int


class FollowUp(BaseModel):
    id: int
    type: ActivityType
    description: str
    follow_up_date: date
    days: int  # from today: negative when overdue
    overdue: bool
    contact_id: int | None
    contact_name: str | None
    deal_id: int | None
    deal_name: str | None


class Dashboard(BaseModel):
    today: date
    this_month: MonthFigures
    last_month: MonthFigures
    months: list[MonthFigures]
    last_12_months: Totals
    open: OpenFigures
    by_stage: list[StageFigures]
    funnel: list[FunnelStage]
    lost: Totals
    follow_ups: list[FollowUp]
    recent: list[TimelineEntry]
