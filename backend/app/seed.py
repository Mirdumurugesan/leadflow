"""
Seed the database with realistic demo data.

    python -m app.seed            # only if the database is empty
    python -m app.seed --reset    # wipe and re-seed

Times are relative to *now*, so the demo always has a follow-up due today and
one that is overdue, whenever you run it. "Today" is computed in SEED_TZ
(default Asia/Kolkata) because the server's clock may be in UTC.
"""
import argparse
import os
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select

from app.db import SessionLocal, init_db
from app.models import Discussion, DiscussionKind, Lead, LeadStatus


def _next_half_hour(dt: datetime) -> datetime:
    dt = dt.replace(second=0, microsecond=0)
    return dt + timedelta(minutes=(30 - dt.minute % 30) or 30)


def _today_at(tz: ZoneInfo, hour: int, minute: int = 0) -> datetime:
    """Today at hh:mm local; if that has passed, the next half hour that is still today."""
    now = datetime.now(tz)
    target = datetime.combine(now.date(), time(hour, minute), tzinfo=tz)
    if target <= now:
        later = _next_half_hour(now + timedelta(hours=1))
        target = later if later.date() == now.date() else _next_half_hour(now)
        if target.date() != now.date():  # seeded in the last minutes of the day
            target = now + timedelta(minutes=5)
    return target.astimezone(timezone.utc)


def build_leads(tz: ZoneInfo) -> list[Lead]:
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    ago = lambda **kw: now - timedelta(**kw)  # noqa: E731
    yesterday_4pm = (datetime.combine(datetime.now(tz).date() - timedelta(days=1), time(16), tzinfo=tz)
                     .astimezone(timezone.utc))

    spec = [
        dict(name="Priya Raman", company="Zenith Wealth Advisors", phone="98400 11223",
             status=LeadStatus.proposal_sent, follow_up_at=_today_at(tz, 16),
             notes=[
                 (ago(days=6), DiscussionKind.system, "Lead created.", None),
                 (ago(days=5), DiscussionKind.note,
                  "Discovery call. 40 advisors, tracking clients in spreadsheets. "
                  "Biggest pain: follow-ups slip and nobody knows who spoke to whom.", None),
                 (ago(days=4, hours=-1), DiscussionKind.system, "Status changed from New to Qualified.", None),
                 (ago(days=2), DiscussionKind.note,
                  "Sent pricing deck for the Team plan. She will review with her MD and revert.",
                  _today_at(tz, 16)),
                 (ago(days=2, minutes=1), DiscussionKind.system, "Status changed from Qualified to Proposal Sent.", None),
             ]),
        dict(name="Arjun Mehta", company="Northstar Capital", phone="99000 44556",
             status=LeadStatus.qualified, follow_up_at=yesterday_4pm,
             notes=[
                 (ago(days=9), DiscussionKind.system, "Lead created.", None),
                 (ago(days=8), DiscussionKind.note, "Intro call. Interested, wants a demo for the partners.", None),
                 (ago(days=3), DiscussionKind.note,
                  "Demo went well. Asked for our data-security note before he can sign off.", yesterday_4pm),
             ]),
        dict(name="Kavya Iyer", company="Lotus Family Office", phone=None,
             status=LeadStatus.new, follow_up_at=None,
             notes=[
                 (ago(hours=2), DiscussionKind.system, "Lead created.", None),
                 (ago(hours=2), DiscussionKind.note, "Inbound lead from the website contact form.", None),
             ]),
        dict(name="Rohan Das", company="Meridian Insurance", phone="97100 77889",
             status=LeadStatus.contacted, follow_up_at=_next_half_hour(now + timedelta(days=2)),
             notes=[
                 (ago(days=12), DiscussionKind.system, "Lead created.", None),
                 (ago(days=7), DiscussionKind.note, "Left a voicemail with his assistant.",
                  _next_half_hour(now + timedelta(days=2))),
             ]),
        dict(name="Sneha Kulkarni", company="Pinnacle Advisors", phone="98800 33221",
             status=LeadStatus.won, follow_up_at=None,
             notes=[
                 (ago(days=30), DiscussionKind.system, "Lead created.", None),
                 (ago(days=24), DiscussionKind.note, "Negotiated annual billing with a 10% discount.", None),
                 (ago(days=21), DiscussionKind.note, "Contract signed! Sending the onboarding kit.", None),
                 (ago(days=21, minutes=-1), DiscussionKind.system, "Status changed from Proposal Sent to Won.", None),
             ]),
        dict(name="Vikram Shah", company="Bluewater Partners", phone=None,
             status=LeadStatus.lost, follow_up_at=None,
             notes=[
                 (ago(days=20), DiscussionKind.system, "Lead created.", None),
                 (ago(days=10), DiscussionKind.note, "Going with an in-house tool. Worth revisiting next quarter.", None),
                 (ago(days=10, minutes=-1), DiscussionKind.system, "Status changed from Contacted to Lost.", None),
             ]),
    ]

    leads = []
    for s in spec:
        notes = sorted(s.pop("notes"), key=lambda n: n[0])
        last_human = [n for n in notes if n[1] == DiscussionKind.note] or notes
        lead = Lead(**s, created_at=notes[0][0], updated_at=notes[-1][0],
                    last_note=last_human[-1][2], last_activity_at=last_human[-1][0])
        lead.discussions = [Discussion(created_at=t, kind=k, note=text, follow_up_at=f) for t, k, text, f in notes]
        leads.append(lead)
    return leads


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed LeadFlow with demo data")
    parser.add_argument("--reset", action="store_true", help="delete existing data first")
    args = parser.parse_args()

    init_db()
    tz = ZoneInfo(os.environ.get("SEED_TZ", "Asia/Kolkata"))
    with SessionLocal() as db:
        if args.reset:
            db.execute(delete(Discussion))
            db.execute(delete(Lead))
            db.commit()
        elif db.scalar(select(func.count(Lead.id))):
            print("Database already has leads; skipping (use --reset to re-seed).")
            return
        leads = build_leads(tz)
        db.add_all(leads)
        db.commit()
        print(f"Seeded {len(leads)} leads with {sum(len(lead.discussions) for lead in leads)} discussions.")


if __name__ == "__main__":
    main()
