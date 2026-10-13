export const STATUSES = ["New", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"] as const;
export type LeadStatus = (typeof STATUSES)[number];

export interface Lead {
  id: number;
  name: string;
  company: string | null;
  phone: string | null;
  status: LeadStatus;
  follow_up_at: string | null; // ISO 8601, UTC
  last_note: string | null;
  last_activity_at: string;
  created_at: string;
}

export interface Discussion {
  id: number;
  kind: "note" | "system";
  note: string;
  follow_up_at: string | null;
  created_at: string;
}

export interface LeadDetail extends Lead {
  discussions: Discussion[];
}

export interface NewLead {
  name: string;
  company?: string;
  phone?: string;
}
