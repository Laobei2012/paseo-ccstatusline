import { expect, it } from "vitest";
import { selectUsage, type AgentUsageEntry } from "../shared/usage";

const claude: AgentUsageEntry = {
  id: "claude:account", sourceId: "claude", sourceLabel: "Claude", account: { label: "Example account" }, fetchedAt: "",
  report: { status: "available", windows: [
    { id: "five_hour", label: "Session", usedPct: 89, resetsAt: "2026-10-31T06:20:00Z" },
    { id: "weekly", label: "Weekly", usedPct: 41, resetsAt: "2026-11-05T00:00:00Z" },
  ] },
};
const absent = { account: null, source: null, session: null, weekly: null };

it("uses the attributed account across harness providers and exact window IDs", () => {
  expect(selectUsage([claude], "claude")).toEqual({ account: "Example account", source: "Claude",
    session: { usedPct: 89, resetsAt: "2026-10-31T06:20:00Z" }, weekly: { usedPct: 41, resetsAt: "2026-11-05T00:00:00Z" } });
  expect(selectUsage([claude], "zerosub")).toEqual(absent);
  expect(selectUsage([claude], "pi").account).toBe("Example account");
});

it("does not guess among multiple reports or reuse last-successful data as current", () => {
  expect(selectUsage([], "claude")).toEqual(absent);
  expect(selectUsage([claude, { ...claude, id: "claude:other" }], "claude")).toEqual(absent);
  expect(selectUsage([{ ...claude, report: { status: "error", error: "Unavailable" } }], "claude")).toEqual(absent);
  if (claude.report.status !== "available") throw new Error("Expected fixture report");
  expect(selectUsage([{ ...claude, lastSuccessful: { fetchedAt: "", report: claude.report }, report: { status: "unavailable", problem: { kind: "no_quota", detail: "Unavailable" } } }], "claude")).toEqual(absent);
});

it("keeps source metadata separate when the daemon has no account label", () => {
  expect(selectUsage([{ ...claude, account: {} }], "claude")).toMatchObject({ account: null, source: "Claude" });
});

it("never selects windows by display label and retains zero usage", () => {
  expect(selectUsage([{ ...claude, report: { status: "available", windows: [
    { id: "other", label: "Session", usedPct: 99 }, { id: "weekly", label: "Weekly", usedPct: 0 },
  ] } }], "claude")).toMatchObject({ session: null, weekly: { usedPct: 0, resetsAt: null } });
});
