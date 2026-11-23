"""Pydantic models for every request and response, with the field rules from the data model.

Patch models give every field a default of None and use exclude_unset, so a PATCH changes
only the fields it sends. A required field sent as null fails its type check.
"""

import re
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import (
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
MESSAGES = {
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


def _blank_to_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _check_email(value: str | None) -> str | None:
    if value is not None and not EMAIL.match(value):
        raise PydanticCustomError("accountable", MESSAGES["email"])
    return value


def _add_scheme(value: str | None) -> str | None:
    if value is not None and not SCHEME.match(value):
        value = f"https://{value}"
    return value


def _local_time(value: datetime) -> datetime:
    # Times are kept as local time with no zone. A time sent with a zone is converted.
    if value.tzinfo is not None:
        value = value.astimezone().replace(tzinfo=None)
    return value.replace(microsecond=0)


def _optional(max_length: int):
    # The limit goes on the str alone: on the whole union it would also be applied to None.
    text = Annotated[str, StringConstraints(max_length=max_length)]
    return Annotated[text | None, BeforeValidator(_blank_to_none)]


def _required(max_length: int):
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)]


OrgName = _required(120)
ContactName = _required(120)
DealName = _required(160)
Description = _required(5000)
Notes = _optional(5000)
Industry = _optional(80)
Phone = _optional(40)
JobTitle = _optional(120)
Website = Annotated[_optional(300), AfterValidator(_add_scheme)]
Email = Annotated[_optional(254), AfterValidator(_check_email)]
Money = Annotated[int, Field(ge=0, le=100_000_000)]
Percent = Annotated[int, Field(ge=0, le=100)]
OptionalId = Annotated[int | None, BeforeValidator(_blank_to_none)]
OptionalDate = Annotated[date | None, BeforeValidator(_blank_to_none)]
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
    name: OrgName = None
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
    name: ContactName = None
    email: Email = None
    phone: Phone = None
    job_title: JobTitle = None
    organization_id: OptionalId = None
    status: Status = None


class DealIn(Request):
    name: DealName
    organization_id: OptionalId = None
    contact_id: OptionalId = None
    stage: StageKey = "new"
    value: Money
    probability: Percent | None = None
    close_date: date | None = None


class DealPatch(Request):
    name: DealName = None
    organization_id: OptionalId = None
    contact_id: OptionalId = None
    stage: StageKey = None
    value: Money = None
    probability: Percent = None
    close_date: date = None


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
    type: ActivityType = None
    description: Description = None
    occurred_at: LocalTime = None
    follow_up_date: OptionalDate = None
    follow_up_done: bool = None


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
