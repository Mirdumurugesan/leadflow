import type { Lead } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago", "2 weeks ago", "4 months ago". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MINUTE) return "just now";
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"} ago`;
  if (diff < HOUR) return unit(Math.floor(diff / MINUTE), "minute");
  if (diff < DAY) return unit(Math.floor(diff / HOUR), "hour");
  if (diff < 7 * DAY) return unit(Math.floor(diff / DAY), "day");
  if (diff < 30 * DAY) return unit(Math.floor(diff / (7 * DAY)), "week");
  if (diff < 365 * DAY) return unit(Math.floor(diff / (30 * DAY)), "month");
  return unit(Math.floor(diff / (365 * DAY)), "year");
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export type FollowUpState = "overdue" | "today" | "upcoming";

/**
 * Where a lead's follow-up stands, in the viewer's own timezone.
 * Won/Lost leads never need a reminder.
 */
export function followUpState(lead: Pick<Lead, "follow_up_at" | "status">, now: Date = new Date()): FollowUpState | null {
  if (!lead.follow_up_at || lead.status === "Won" || lead.status === "Lost") return null;
  const due = new Date(lead.follow_up_at);
  if (due.getTime() < now.getTime()) return "overdue";
  if (isSameLocalDay(due, now)) return "today";
  return "upcoming";
}

/** Split into the pinned section (overdue + due today, soonest first) and everything else. */
export function splitForList<T extends Pick<Lead, "follow_up_at" | "status">>(leads: T[], now: Date = new Date()) {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const lead of leads) {
    const state = followUpState(lead, now);
    if (state === "overdue" || state === "today") pinned.push(lead);
    else rest.push(lead);
  }
  pinned.sort((a, b) => new Date(a.follow_up_at!).getTime() - new Date(b.follow_up_at!).getTime());
  return { pinned, rest };
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** Human label for a follow-up chip. */
export function followUpLabel(iso: string, now: Date = new Date()): string {
  const due = new Date(iso);
  const tomorrow = new Date(now.getTime() + DAY);
  if (isSameLocalDay(due, now)) return `today at ${formatTime(iso)}`;
  if (isSameLocalDay(due, tomorrow)) return `tomorrow at ${formatTime(iso)}`;
  return formatDateTime(iso);
}

/** Combine <input type="date"> and <input type="time"> values (local time) into a UTC ISO string. */
export function localDateTimeToIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
