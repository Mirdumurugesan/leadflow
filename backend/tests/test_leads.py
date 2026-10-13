from datetime import datetime, timedelta, timezone

import pytest


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def make(client, name="Priya Raman", **kw):
    r = client.post("/api/leads", json={"name": name, **kw})
    assert r.status_code == 201, r.text
    return r.json()


def note(client, lead_id, text="Called, interested.", follow_up_at=None):
    body = {"note": text}
    if follow_up_at is not None:
        body["follow_up_at"] = follow_up_at
    return client.post(f"/api/leads/{lead_id}/discussions", json=body)


# ── create ────────────────────────────────────────────────────────────────────

def test_create_lead_defaults_and_location(client):
    r = client.post("/api/leads", json={"name": "  Priya Raman ", "company": "Zenith", "phone": ""})
    assert r.status_code == 201
    lead = r.json()
    assert r.headers["location"] == f"/api/leads/{lead['id']}"
    assert lead["name"] == "Priya Raman" and lead["status"] == "New"
    assert lead["company"] == "Zenith" and lead["phone"] is None  # blank optional -> null
    assert lead["last_note"] == "Lead created." and lead["follow_up_at"] is None


@pytest.mark.parametrize("body", [{}, {"name": ""}, {"name": "   "}, {"name": "x" * 121}])
def test_create_lead_requires_name(client, body):
    r = client.post("/api/leads", json=body)
    assert r.status_code == 422
    assert "detail" in r.json()


# ── list / filter / search ───────────────────────────────────────────────────

def test_list_newest_activity_first_and_note_bumps_lead(client):
    a, b = make(client, "A"), make(client, "B")
    assert [x["name"] for x in client.get("/api/leads").json()] == ["B", "A"]
    note(client, a["id"], "Follow-up call")
    rows = client.get("/api/leads").json()
    assert [x["name"] for x in rows] == ["A", "B"]
    assert rows[0]["last_note"] == "Follow-up call"


def test_filter_by_status(client):
    a = make(client, "A")
    make(client, "B")
    client.patch(f"/api/leads/{a['id']}", json={"status": "Qualified"})
    assert [x["name"] for x in client.get("/api/leads", params={"status": "Qualified"}).json()] == ["A"]
    assert [x["name"] for x in client.get("/api/leads", params={"status": "New"}).json()] == ["B"]


def test_invalid_status_filter_is_422(client):
    assert client.get("/api/leads", params={"status": "Nope"}).status_code == 422


def test_search_name_or_company_case_insensitive(client):
    make(client, "Priya Raman", company="Zenith")
    make(client, "Arjun Mehta", company="Northstar")
    assert [x["name"] for x in client.get("/api/leads", params={"q": "priya"}).json()] == ["Priya Raman"]
    assert [x["name"] for x in client.get("/api/leads", params={"q": "NORTH"}).json()] == ["Arjun Mehta"]
    assert client.get("/api/leads", params={"q": "zzz"}).json() == []


# ── detail / timeline ────────────────────────────────────────────────────────

def test_get_unknown_lead_is_404(client):
    r = client.get("/api/leads/999")
    assert r.status_code == 404 and r.json()["detail"] == "Lead 999 not found"


def test_timeline_is_reverse_chronological(client):
    lead = make(client)
    note(client, lead["id"], "first")
    note(client, lead["id"], "second")
    d = client.get(f"/api/leads/{lead['id']}").json()["discussions"]
    assert [x["note"] for x in d] == ["second", "first", "Lead created."]
    assert d[-1]["kind"] == "system"


# ── discussions + follow-ups ─────────────────────────────────────────────────

def test_note_with_follow_up_updates_lead_and_returns_it(client):
    lead = make(client)
    when = datetime.now(timezone.utc) + timedelta(hours=3)
    r = note(client, lead["id"], "Sent proposal", iso(when))
    assert r.status_code == 201
    body = r.json()
    assert body["discussion"]["note"] == "Sent proposal"
    assert body["lead"]["last_note"] == "Sent proposal"
    assert datetime.fromisoformat(body["lead"]["follow_up_at"]) == when
    listed = client.get("/api/leads").json()[0]
    assert listed["follow_up_at"] == body["lead"]["follow_up_at"]


def test_follow_up_in_the_past_is_rejected(client):
    lead = make(client)
    r = note(client, lead["id"], "x", iso(datetime.now(timezone.utc) - timedelta(days=1)))
    assert r.status_code == 422 and "future" in r.json()["detail"]


def test_follow_up_without_timezone_is_rejected(client):
    lead = make(client)
    r = note(client, lead["id"], "x", "2030-01-01T10:00:00")
    assert r.status_code == 422


@pytest.mark.parametrize("text", ["", "   "])
def test_blank_note_is_rejected(client, text):
    lead = make(client)
    assert note(client, lead["id"], text).status_code == 422


def test_note_on_unknown_lead_is_404(client):
    assert note(client, 12345).status_code == 404


def test_note_without_follow_up_keeps_a_future_one(client):
    lead = make(client)
    when = iso(datetime.now(timezone.utc) + timedelta(days=1))
    note(client, lead["id"], "set", when)
    r = note(client, lead["id"], "quick update")
    assert r.json()["lead"]["follow_up_at"] is not None


def test_note_without_follow_up_completes_a_due_one(client):
    from app.models import Lead
    lead = make(client)
    with client.Session() as s:  # make the follow-up already due
        row = s.get(Lead, lead["id"])
        row.follow_up_at = datetime.now(timezone.utc) - timedelta(hours=1)
        s.commit()
    r = note(client, lead["id"], "Called back as promised")
    assert r.json()["lead"]["follow_up_at"] is None


# ── status updates ───────────────────────────────────────────────────────────

def test_status_update_persists_and_is_logged(client):
    lead = make(client)
    r = client.patch(f"/api/leads/{lead['id']}", json={"status": "Proposal Sent"})
    assert r.status_code == 200 and r.json()["status"] == "Proposal Sent"
    detail = client.get(f"/api/leads/{lead['id']}").json()
    assert detail["status"] == "Proposal Sent"
    assert detail["discussions"][0]["note"] == "Status changed from New to Proposal Sent."
    assert detail["last_note"] == "Lead created."  # system events don't replace the last human note


def test_closing_a_lead_clears_its_follow_up(client):
    lead = make(client)
    note(client, lead["id"], "x", iso(datetime.now(timezone.utc) + timedelta(hours=2)))
    r = client.patch(f"/api/leads/{lead['id']}", json={"status": "Won"})
    assert r.json()["follow_up_at"] is None


def test_same_status_is_a_no_op(client):
    lead = make(client)
    client.patch(f"/api/leads/{lead['id']}", json={"status": "New"})
    assert len(client.get(f"/api/leads/{lead['id']}").json()["discussions"]) == 1


@pytest.mark.parametrize("body,code", [({"status": "Maybe"}, 422), ({}, 400), ({"name": " "}, 422)])
def test_bad_updates(client, body, code):
    lead = make(client)
    assert client.patch(f"/api/leads/{lead['id']}", json=body).status_code == code


def test_update_unknown_lead_is_404(client):
    assert client.patch("/api/leads/999", json={"status": "Won"}).status_code == 404


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}
