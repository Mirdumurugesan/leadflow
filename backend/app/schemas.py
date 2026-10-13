from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import DiscussionKind, LeadStatus


def _clean_optional(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    company: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v

    @field_validator("company", "phone")
    @classmethod
    def blank_to_none(cls, v: str | None) -> str | None:
        return _clean_optional(v)


class LeadUpdate(BaseModel):
    """Partial update. Only the fields that are sent are changed."""

    status: LeadStatus | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    company: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("name must not be blank")
        return v.strip() if v else v

    @field_validator("company", "phone")
    @classmethod
    def blank_to_none(cls, v: str | None) -> str | None:
        return _clean_optional(v)


class DiscussionCreate(BaseModel):
    note: str = Field(min_length=1, max_length=5000)
    # Must include a timezone offset (the frontend sends ISO 8601 in UTC).
    follow_up_at: datetime | None = None

    @field_validator("note")
    @classmethod
    def note_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("note must not be blank")
        return v

    @field_validator("follow_up_at")
    @classmethod
    def follow_up_has_timezone(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is None:
            raise ValueError("follow_up_at must include a timezone, e.g. 2026-10-14T09:30:00Z")
        return v


class DiscussionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: DiscussionKind
    note: str
    follow_up_at: datetime | None
    created_at: datetime


class LeadSummary(BaseModel):
    """What the list needs: one row per lead."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    company: str | None
    phone: str | None
    status: LeadStatus
    follow_up_at: datetime | None
    last_note: str | None
    last_activity_at: datetime
    created_at: datetime


class LeadDetail(LeadSummary):
    """Lead plus its full timeline, newest first."""

    discussions: list[DiscussionOut]


class DiscussionCreated(BaseModel):
    """Returned after logging a note so the list can update without a refetch."""

    discussion: DiscussionOut
    lead: LeadSummary
