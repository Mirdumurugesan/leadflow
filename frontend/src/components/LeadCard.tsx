import { followUpLabel, followUpState, timeAgo } from "@/lib/time";
import type { Lead } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  lead: Lead;
  now: Date;
  onOpen: (lead: Lead) => void;
}

export function LeadCard({ lead, now, onOpen }: Props) {
  const state = followUpState(lead, now);
  const closed = lead.status === "Won" || lead.status === "Lost";

  const frame =
    state === "overdue"
      ? "border-rose-300 bg-rose-50/60 hover:border-rose-400"
      : state === "today"
        ? "border-blue-200 bg-blue-50/60 hover:border-blue-300"
        : "border-slate-200 bg-white hover:border-slate-300";

  return (
    <button
      type="button"
      onClick={() => onOpen(lead)}
      className={`block w-full rounded-xl border p-4 text-left shadow-sm transition hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${frame} ${closed ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">
          {lead.name}
          {lead.company && <span className="ml-1.5 text-sm font-normal text-slate-500">({lead.company})</span>}
        </h3>
        <StatusBadge status={lead.status} />
      </div>

      <p className="mt-1.5 line-clamp-1 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">Last note:</span> {lead.last_note ?? "—"}{" "}
        <span className="whitespace-nowrap text-xs text-slate-400">{timeAgo(lead.last_activity_at, now)}</span>
      </p>

      {lead.follow_up_at && state && (
        <span
          className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${
            state === "overdue"
              ? "bg-rose-100 text-rose-700"
              : state === "today"
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          <span aria-hidden>{state === "overdue" ? "⚠️" : "🔔"}</span>
          {state === "overdue" ? "Overdue · was due " : "Follow-up "}
          {followUpLabel(lead.follow_up_at, now)}
        </span>
      )}
    </button>
  );
}
