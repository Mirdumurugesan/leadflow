import { describe, expect, it } from "vitest";
import { followUpState, localDateTimeToIso, splitForList, timeAgo } from "./time";

const now = new Date("2026-10-13T10:00:00+05:30");
const at = (s: string) => new Date(s).toISOString();

describe("timeAgo", () => {
  it.each([
    ["2026-10-13T09:59:40+05:30", "just now"],
    ["2026-10-13T09:59:00+05:30", "1 minute ago"],
    ["2026-10-13T08:00:00+05:30", "2 hours ago"],
    ["2026-10-11T10:00:00+05:30", "2 days ago"],
    ["2026-10-06T10:00:00+05:30", "1 week ago"],
    ["2026-08-01T10:00:00+05:30", "2 months ago"],
  ])("%s -> %s", (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
});

describe("followUpState", () => {
  const lead = (follow_up_at: string | null, status = "Contacted" as const) => ({ follow_up_at, status });

  it("is null without a follow-up or for closed leads", () => {
    expect(followUpState(lead(null), now)).toBeNull();
    expect(followUpState({ follow_up_at: at("2026-10-13T15:00:00+05:30"), status: "Won" }, now)).toBeNull();
  });
  it("today, later", () => expect(followUpState(lead(at("2026-10-13T15:00:00+05:30")), now)).toBe("today"));
  it("today but time has passed -> overdue", () =>
    expect(followUpState(lead(at("2026-10-13T09:00:00+05:30")), now)).toBe("overdue"));
  it("yesterday -> overdue", () => expect(followUpState(lead(at("2026-10-12T16:00:00+05:30")), now)).toBe("overdue"));
  it("tomorrow -> upcoming", () => expect(followUpState(lead(at("2026-10-14T09:00:00+05:30")), now)).toBe("upcoming"));
  it("uses the local day, not UTC: 23:30 local is still today", () =>
    expect(followUpState(lead(at("2026-10-13T23:30:00+05:30")), now)).toBe("today"));
});

describe("splitForList", () => {
  it("pins overdue and today's follow-ups, soonest first, and keeps the rest in order", () => {
    const leads = [
      { id: 1, follow_up_at: null, status: "New" as const },
      { id: 2, follow_up_at: at("2026-10-13T16:00:00+05:30"), status: "Proposal Sent" as const },
      { id: 3, follow_up_at: at("2026-10-12T16:00:00+05:30"), status: "Qualified" as const },
      { id: 4, follow_up_at: at("2026-10-15T16:00:00+05:30"), status: "Contacted" as const },
      { id: 5, follow_up_at: at("2026-10-13T16:00:00+05:30"), status: "Won" as const },
    ];
    const { pinned, rest } = splitForList(leads, now);
    expect(pinned.map((l) => l.id)).toEqual([3, 2]);
    expect(rest.map((l) => l.id)).toEqual([1, 4, 5]);
  });
});

describe("localDateTimeToIso", () => {
  it("treats inputs as local time", () =>
    expect(localDateTimeToIso("2026-10-13", "14:00")).toBe("2026-10-13T08:30:00.000Z"));
  it("needs both parts", () => expect(localDateTimeToIso("2026-10-13", "")).toBeNull());
});
