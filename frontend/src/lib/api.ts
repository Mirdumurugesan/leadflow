import type { Discussion, Lead, LeadDetail, LeadStatus, NewLead } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Turn FastAPI's error body (string or validation list) into one readable line. */
function messageFrom(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: (string | number)[]; msg?: string }) => {
        const field = d.loc?.filter((p) => p !== "body").join(".");
        const msg = (d.msg ?? "").replace(/^Value error, /, "");
        return field ? `${field}: ${msg}` : msg;
      })
      .join("; ");
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Can't reach the API. Is the backend running on " + BASE + "?");
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageFrom(body, `Request failed (${res.status})`));
  return body as T;
}

export const api = {
  listLeads(params: { status?: LeadStatus; q?: string } = {}, signal?: AbortSignal) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.q?.trim()) qs.set("q", params.q.trim());
    const s = qs.toString();
    return request<Lead[]>(`/api/leads${s ? `?${s}` : ""}`, { signal });
  },
  getLead: (id: number) => request<LeadDetail>(`/api/leads/${id}`),
  createLead: (lead: NewLead) => request<Lead>("/api/leads", { method: "POST", body: JSON.stringify(lead) }),
  updateStatus: (id: number, status: LeadStatus) =>
    request<Lead>(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  addDiscussion: (id: number, note: string, followUpAt: string | null) =>
    request<{ discussion: Discussion; lead: Lead }>(`/api/leads/${id}/discussions`, {
      method: "POST",
      body: JSON.stringify({ note, follow_up_at: followUpAt }),
    }),
};
