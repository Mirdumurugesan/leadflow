"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { splitForList } from "@/lib/time";
import type { Lead, LeadStatus } from "@/lib/types";
import { AddLeadDialog } from "./AddLeadDialog";
import { FilterBar } from "./FilterBar";
import { LeadCard } from "./LeadCard";
import { LeadDialog } from "./LeadDialog";
import { SearchBox } from "./SearchBox";

/** Re-render once a minute so "x minutes ago" and overdue states stay current. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function LeadBoard() {
  const now = useNow();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState<LeadStatus | null>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openLeadId, setOpenLeadId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await api.listLeads({ status: status ?? undefined, q: debouncedQuery }, signal);
        setLeads(data);
        setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof ApiError ? err.message : "Could not load leads.");
      } finally {
        setLoading(false);
      }
    },
    [status, debouncedQuery],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  /** Apply a change from the dialog instantly, then re-sync with the server in the background. */
  const applyLeadChange = useCallback(
    (updated: Lead) => {
      setLeads((cur) => {
        const rest = cur.filter((l) => l.id !== updated.id);
        const stillMatches = !status || updated.status === status;
        // Newest activity first, same as the API.
        return (stillMatches ? [updated, ...rest] : rest).sort(
          (a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime(),
        );
      });
      load();
    },
    [status, load],
  );

  const { pinned, rest } = useMemo(() => splitForList(leads, now), [leads, now]);
  const filtered = Boolean(status || debouncedQuery.trim());
  const closeLead = useCallback(() => setOpenLeadId(null), []);
  const closeAdd = useCallback(() => setAdding(false), []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-blue-600">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
              <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M15 7h6v6" />
            </svg>
            LeadFlow
          </h1>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            + Add New Lead
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <FilterBar value={status} onChange={setStatus} />
          <SearchBox value={query} onChange={setQuery} />
        </div>

        {error && (
          <div role="alert" className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <button type="button" onClick={() => load()} className="font-semibold underline">Retry</button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading leads…</p>
        ) : (
          <>
            {pinned.length > 0 && (
              <section aria-labelledby="today-title">
                <h2 id="today-title" className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600">
                  <span aria-hidden>📌</span> Today&apos;s follow-ups
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">{pinned.length}</span>
                </h2>
                <div className="space-y-3">
                  {pinned.map((l) => (
                    <LeadCard key={l.id} lead={l} now={now} onOpen={(lead) => setOpenLeadId(lead.id)} />
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="all-title">
              <h2 id="all-title" className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-600">
                {filtered ? "Matching leads" : "All leads"}
              </h2>
              {rest.length === 0 && pinned.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
                  {filtered ? "No leads match these filters." : "No leads yet. Add your first one to get started."}
                </div>
              ) : rest.length === 0 ? (
                <p className="text-sm text-slate-500">Everything else is pinned above.</p>
              ) : (
                <div className="space-y-3">
                  {rest.map((l) => (
                    <LeadCard key={l.id} lead={l} now={now} onOpen={(lead) => setOpenLeadId(lead.id)} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {openLeadId !== null && (
        <LeadDialog leadId={openLeadId} now={now} onClose={closeLead} onLeadChanged={applyLeadChange} />
      )}
      {adding && (
        <AddLeadDialog
          onClose={closeAdd}
          onCreated={(lead) => {
            setAdding(false);
            applyLeadChange(lead);
          }}
        />
      )}
    </div>
  );
}
