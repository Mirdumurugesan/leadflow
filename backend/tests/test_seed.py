from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.models import LeadStatus
from app.seed import build_leads


def test_seed_has_at_least_five_leads_with_history():
    leads = build_leads(ZoneInfo("Asia/Kolkata"))
    assert len(leads) >= 5
    assert all(len(lead.discussions) >= 2 for lead in leads)
    assert {lead.status for lead in leads} >= {LeadStatus.new, LeadStatus.won, LeadStatus.lost}


def test_seed_always_has_a_due_today_and_an_overdue_follow_up():
    tz = ZoneInfo("Asia/Kolkata")
    today = datetime.now(tz).date()
    ups = [lead.follow_up_at.astimezone(tz) for lead in build_leads(tz) if lead.follow_up_at]
    now = datetime.now(timezone.utc)
    assert any(f.date() == today and f > now for f in ups)
    assert any(f < now for f in ups)
