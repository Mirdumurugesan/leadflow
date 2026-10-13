from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Always store UTC and always hand back timezone-aware UTC datetimes.

    SQLite has no timezone support, so without this a value written as
    10:00+05:30 would silently come back as a naive 10:00.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("naive datetimes are not allowed; pass a timezone-aware value")
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


class LeadStatus(str, Enum):
    new = "New"
    contacted = "Contacted"
    qualified = "Qualified"
    proposal_sent = "Proposal Sent"
    won = "Won"
    lost = "Lost"

    @property
    def is_closed(self) -> bool:
        return self in (LeadStatus.won, LeadStatus.lost)


class DiscussionKind(str, Enum):
    note = "note"        # written by the sales rep
    system = "system"    # recorded by the app: lead created, status changed


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    company: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[LeadStatus] = mapped_column(
        SAEnum(LeadStatus, values_callable=lambda e: [m.value for m in e], native_enum=False, length=20),
        default=LeadStatus.new,
        index=True,
    )
    follow_up_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), index=True)

    # Denormalised from the newest discussion so the list is a single query.
    last_note: Mapped[str | None] = mapped_column(Text)
    last_activity_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, index=True)

    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, onupdate=utcnow)

    discussions: Mapped[list["Discussion"]] = relationship(
        back_populates="lead", cascade="all, delete-orphan", order_by="Discussion.created_at.desc()"
    )


class Discussion(Base):
    __tablename__ = "discussions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    kind: Mapped[DiscussionKind] = mapped_column(
        SAEnum(DiscussionKind, values_callable=lambda e: [m.value for m in e], native_enum=False, length=10),
        default=DiscussionKind.note,
    )
    note: Mapped[str] = mapped_column(Text)
    # The follow-up that was scheduled together with this note (shown in the timeline).
    follow_up_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, index=True)

    lead: Mapped[Lead] = relationship(back_populates="discussions")
