"""Business rules, kept out of the HTTP layer so they are easy to test and explain."""
from datetime import datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Discussion, DiscussionKind, Lead, LeadStatus, utcnow

# Small tolerance so a follow-up picked for "now" in the browser isn't rejected
# because a few seconds passed before the request arrived.
FOLLOW_UP_GRACE = timedelta(minutes=2)


class FollowUpInPast(ValueError):
    pass


def list_leads(db: Session, status: LeadStatus | None = None, q: str | None = None) -> list[Lead]:
    stmt = select(Lead)
    if status is not None:
        stmt = stmt.where(Lead.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Lead.name.ilike(like), Lead.company.ilike(like)))
    stmt = stmt.order_by(Lead.last_activity_at.desc(), Lead.id.desc())
    return list(db.scalars(stmt))


def create_lead(db: Session, name: str, company: str | None, phone: str | None) -> Lead:
    now = utcnow()
    lead = Lead(name=name, company=company, phone=phone, status=LeadStatus.new,
                last_note="Lead created.", last_activity_at=now, created_at=now, updated_at=now)
    lead.discussions.append(Discussion(kind=DiscussionKind.system, note="Lead created.", created_at=now))
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def add_discussion(db: Session, lead: Lead, note: str, follow_up_at: datetime | None) -> Discussion:
    """
    Log a conversation with the lead.

    Follow-up rules:
      * a note WITH a follow-up sets (or replaces) the lead's follow-up;
      * a note WITHOUT one clears a follow-up that is already due - logging the
        conversation is what completes it - but keeps a future one untouched.
    """
    now = utcnow()
    if follow_up_at is not None and follow_up_at < now - FOLLOW_UP_GRACE:
        raise FollowUpInPast("follow_up_at must be in the future")

    discussion = Discussion(kind=DiscussionKind.note, note=note, follow_up_at=follow_up_at, created_at=now)
    lead.discussions.append(discussion)

    if follow_up_at is not None:
        lead.follow_up_at = follow_up_at
    elif lead.follow_up_at is not None and lead.follow_up_at <= now:
        lead.follow_up_at = None

    lead.last_note = note
    lead.last_activity_at = now
    db.commit()
    db.refresh(discussion)
    db.refresh(lead)
    return discussion


def update_lead(db: Session, lead: Lead, changes: dict) -> Lead:
    new_status: LeadStatus | None = changes.pop("status", None)
    if changes.get("name"):
        lead.name = changes["name"]
    for field in ("company", "phone"):
        if field in changes:
            setattr(lead, field, changes[field])

    if new_status is not None and new_status != lead.status:
        old = lead.status
        lead.status = new_status
        # Closed deals don't need reminders.
        if new_status.is_closed:
            lead.follow_up_at = None
        lead.discussions.append(Discussion(
            kind=DiscussionKind.system, note=f"Status changed from {old.value} to {new_status.value}.",
        ))

    db.commit()
    db.refresh(lead)
    return lead
