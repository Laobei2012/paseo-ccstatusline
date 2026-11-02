import { expect, it } from "vitest";
import type { UsageReportEntry } from "@getpaseo/protocol/messages";
import { selectUsage } from "../shared/usage";

const available = {
  status: "available" as const,
  windows: [
    { id: "five_hour", label: "Session", usedPct: 89, resetsAt: "2026-10-31T06:20:00Z" },
    { id: "weekly", label: "Weekly", usedPct: 41, resetsAt: "2026-11-05T00:00:00Z" },
  ],
};
const entry: UsageReportEntry = {
  id: "account-report", sourceId: "routed-source", sourceLabel: "Source",
  account: { label: "Example account" }, fetchedAt: "", report: available,
};
const absent = { account: null, session: null, weekly: null };

it("uses the scoped account and exact windows regardless of source ID", () => {
  expect(selectUsage([entry])).toEqual({ account: "Example account",
    session: { usedPct: 89, resetsAt: available.windows[0].resetsAt },
    weekly: { usedPct: 41, resetsAt: available.windows[1].resetsAt } });
});

it("hides missing, ambiguous and unavailable reports without using stale successful data", () => {
  expect(selectUsage([])).toEqual(absent);
  expect(selectUsage([entry, entry])).toEqual(absent);
  expect(selectUsage([{ ...entry, report: { status: "error", error: "offline" },
    lastSuccessful: { fetchedAt: "", report: available } }])).toEqual(absent);
  expect(selectUsage([{ ...entry, report: { status: "unavailable", problem: { kind: "rejected", status: 401 } } }])).toEqual(absent);
});

it("never selects windows by display labels or chooses among duplicate IDs", () => {
  expect(selectUsage([{ ...entry, report: { ...available, windows: [{ ...available.windows[0], id: "other" }] } }]))
    .toEqual({ account: "Example account", session: null, weekly: null });
  expect(selectUsage([{ ...entry, report: { ...available, windows: [available.windows[0], available.windows[0]] } }]).session).toBeNull();
});

it("normalizes optional metrics without losing a valid reset or zero percentage", () => {
  expect(selectUsage([{ ...entry, account: {}, report: { ...available, windows: [
    { id: "five_hour", label: "Session", usedPct: 0 },
    { id: "weekly", label: "Weekly", usedPct: NaN, resetsAt: "2026-11-05T00:00:00Z" },
  ] } }])).toEqual({ account: null, session: { usedPct: 0, resetsAt: null }, weekly: { usedPct: null, resetsAt: "2026-11-05T00:00:00Z" } });
});
