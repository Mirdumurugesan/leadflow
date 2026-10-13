from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app import services
from app.db import get_session
from app.models import Lead, LeadStatus
from app.schemas import (
    DiscussionCreate, DiscussionCreated, DiscussionOut, LeadCreate, LeadDetail, LeadSummary, LeadUpdate,
)

router = APIRouter(prefix="/api/leads", tags=["leads"])


def get_lead_or_404(lead_id: int, db: Session = Depends(get_session)) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {lead_id} not found")
    return lead


@router.get("", response_model=list[LeadSummary])
def list_leads(
    status_filter: LeadStatus | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, max_length=100, description="Search by name or company"),
    db: Session = Depends(get_session),
):
    return services.list_leads(db, status=status_filter, q=q)


@router.post("", response_model=LeadSummary, status_code=status.HTTP_201_CREATED)
def create_lead(body: LeadCreate, response: Response, db: Session = Depends(get_session)):
    lead = services.create_lead(db, body.name, body.company, body.phone)
    response.headers["Location"] = f"/api/leads/{lead.id}"
    return lead


@router.get("/{lead_id}", response_model=LeadDetail)
def get_lead(lead: Lead = Depends(get_lead_or_404)):
    return lead


@router.patch("/{lead_id}", response_model=LeadSummary)
def update_lead(body: LeadUpdate, lead: Lead = Depends(get_lead_or_404), db: Session = Depends(get_session)):
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    return services.update_lead(db, lead, changes)


@router.post("/{lead_id}/discussions", response_model=DiscussionCreated, status_code=status.HTTP_201_CREATED)
def add_discussion(body: DiscussionCreate, lead: Lead = Depends(get_lead_or_404), db: Session = Depends(get_session)):
    try:
        discussion = services.add_discussion(db, lead, body.note, body.follow_up_at)
    except services.FollowUpInPast as e:
        raise HTTPException(status_code=422, detail=str(e))
    return DiscussionCreated(
        discussion=DiscussionOut.model_validate(discussion),
        lead=LeadSummary.model_validate(lead),
    )
