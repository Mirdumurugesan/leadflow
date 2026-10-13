"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, localDateTimeToIso, timeAgo } from "@/lib/time";
import { STATUSES, type Lead, type LeadDetail, type LeadStatus } from "@/lib/types";
import { Modal } from "./Modal";

interface Props {
  leadId: number;
  now: Date;
  onClose: () => void;
  onLeadChanged: (lead: Lead) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Sensible default: the next full hour today. */
function defaultFollowUp() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return { date: toDateInput(d), time: toTimeInput(d) };
}

export function LeadDialog({ leadId, now, onClose, onLeadChanged }: Props) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [withFollowUp, setWithFollowUp] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLead(await api.getLead(leadId));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load this lead.");
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleFollowUp(checked: boolean) {
    setWithFollowUp(checked);
    if (checked && !date) {
      const d = defaultFollowUp();
      setDate(d.date);
      setTime(d.time);
    }
  }

  async function changeStatus(status: LeadStatus) {
    if (!lead || status === lead.status) return;
    setStatusSaving(true);
    try {
      const updated = await api.updateStatus(lead.id, status);
      onLeadChanged(updated);
      await load(); // pick up the "status changed" timeline entry
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not update status.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function saveNote(e?: FormEvent) {
    e?.preventDefault();
    if (!lead) return;
    if (!note.trim()) {
      setFormError("Write a note before saving.");
      return;
    }
    let followUpAt: string | null = null;
    if (withFollowUp) {
      followUpAt = localDateTimeToIso(date, time);
      if (!followUpAt) {
        setFormError("Pick both a date and a time for the follow-up.");
        return;
      }
      if (new Date(followUpAt).getTime() < Date.now() - 60_000) {
        setFormError("The follow-up must be in the future.");
        return;
      }
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await api.addDiscussion(lead.id, note.trim(), followUpAt);
      // Update the dialog and the list right away from the response.
      setLead((cur) => (cur ? { ...cur, ...res.lead, discussions: [res.discussion, ...cur.discussions] } : cur));
      onLeadChanged(res.lead);
      setNote("");
      setWithFollowUp(false);
      setDate("");
      setTime("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save the note.");
    } finally {
      setSaving(false);
    }
  }

  const title = lead ? (
    <div>
      <h2 className="truncate text-lg font-semibold text-slate-900">
        {lead.name}
        {lead.company && <span className="ml-1.5 font-normal text-slate-500">({lead.company})</span>}
      </h2>
      {lead.phone && (
        <a href={`tel:${lead.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600">
          <span aria-hidden>📞</span> {lead.phone}
        </a>
      )}
    </div>
  ) : (
    <h2 className="text-lg font-semibold text-slate-900">Loading…</h2>
  );

  const statusSelect = lead && (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="sr-only">Status</span>
      <select
        value={lead.status}
        disabled={statusSaving}
        onChange={(e) => changeStatus(e.target.value as LeadStatus)}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
        aria-label="Lead status"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </label>
  );

  return (
    <Modal
      labelledBy="lead-dialog-title"
      title={title}
      headerExtra={statusSelect}
      onClose={onClose}
      widthClass="max-w-2xl"
      footer={
        lead && (
          <form onSubmit={saveNote} className="space-y-3">
            <textarea
              data-autofocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote();
              }}
              placeholder="Log a new discussion…"
              rows={3}
              maxLength={5000}
              aria-label="New discussion note"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={withFollowUp}
                  onChange={(e) => toggleFollowUp(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                Set Follow-up
              </label>
              <input
                type="date"
                value={date}
                min={toDateInput(new Date())}
                disabled={!withFollowUp}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Follow-up date"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
              />
              <input
                type="time"
                value={time}
                disabled={!withFollowUp}
                onChange={(e) => setTime(e.target.value)}
                aria-label="Follow-up time"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
              />
              <button
                type="submit"
                disabled={saving}
                className="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Note"}
              </button>
            </div>
            {formError && <p role="alert" className="text-sm text-rose-600">{formError}</p>}
          </form>
        )
      }
    >
      <div className="bg-slate-50 px-6 py-5">
        {loadError && <p role="alert" className="text-sm text-rose-600">{loadError}</p>}
        {!lead && !loadError && <p className="text-sm text-slate-500">Loading timeline…</p>}
        {lead && (
          <ol className="relative space-y-5 border-l-2 border-slate-200 pl-6" aria-label="Discussion history">
            {lead.discussions.map((d, i) => (
              <li key={d.id} className="relative">
                <span
                  aria-hidden
                  className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-slate-50 ${
                    i === 0 ? "bg-blue-500" : "bg-slate-300"
                  }`}
                />
                <p className="text-xs text-slate-500">
                  {formatDateTime(d.created_at)} <span className="text-slate-400">({timeAgo(d.created_at, now)})</span>
                </p>
                <div
                  className={`mt-1.5 rounded-lg border px-3.5 py-2.5 text-sm ${
                    d.kind === "system" ? "border-dashed border-slate-200 bg-white/60 italic text-slate-500" : "border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{d.note}</p>
                  {d.follow_up_at && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      <span aria-hidden>📅</span> Follow-up set for: {formatDateTime(d.follow_up_at)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}
