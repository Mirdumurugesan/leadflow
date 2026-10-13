import type { LeadStatus } from "@/lib/types";

const STYLES: Record<LeadStatus, string> = {
  New: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Contacted: "bg-amber-50 text-amber-800 ring-amber-200",
  Qualified: "bg-sky-50 text-sky-700 ring-sky-200",
  "Proposal Sent": "bg-violet-50 text-violet-700 ring-violet-200",
  Won: "bg-slate-100 text-slate-600 ring-slate-200",
  Lost: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
