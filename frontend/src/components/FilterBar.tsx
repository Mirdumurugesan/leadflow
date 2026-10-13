import { STATUSES, type LeadStatus } from "@/lib/types";

interface Props {
  value: LeadStatus | null;
  onChange: (status: LeadStatus | null) => void;
}

export function FilterBar({ value, onChange }: Props) {
  const options: (LeadStatus | null)[] = [null, ...STATUSES];
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Filters:</span>
      {options.map((s) => {
        const active = value === s;
        return (
          <button
            key={s ?? "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(s)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {s ?? "All"}
          </button>
        );
      })}
    </div>
  );
}
