import { expect, it } from "vitest";
import { selectUsage, type ProviderUsageEntry } from "../shared/usage";

const claude: ProviderUsageEntry = {
  providerId: "claude", displayName: "Claude (example account)", status: "available", planLabel: null,
  windows: [
    { id: "five_hour", label: "Session", shortLabel: "5h", usedPct: 89, resetsAt: "2026-10-31T06:20:00.214429+00:00" },
    { id: "weekly", label: "Weekly", shortLabel: "wk", usedPct: 41, resetsAt: "2026-11-05T00:00:00.214449+00:00" },
  ],
};
const codex: ProviderUsageEntry = { ...claude, providerId: "codex", displayName: "Codex (example account)", windows: [
  { id: "five_hour", label: "5-hour", shortLabel: "5h", usedPct: 100, resetsAt: "2026-10-31T05:03:20.000Z" },
  { id: "weekly", label: "Weekly", shortLabel: "wk", usedPct: 59, resetsAt: "2026-11-04T06:41:08.000Z" },
] };
const absent = { account: null, session: null, weekly: null };

it("selects the matching provider, exact windows and reported account name", () => {
  expect(selectUsage([codex, claude], "claude")).toEqual({ account: claude.displayName, session: { usedPct: 89, resetsAt: claude.windows[0].resetsAt }, weekly: { usedPct: 41, resetsAt: claude.windows[1].resetsAt } });
  expect(selectUsage([claude, codex], "codex").session?.usedPct).toBe(100);
  expect(selectUsage([claude], "zerosub")).toEqual(absent);
});

it("hides missing, ambiguous and unavailable reports", () => {
  expect(selectUsage([], "claude")).toEqual(absent);
  expect(selectUsage([claude, claude], "claude")).toEqual(absent);
  expect(selectUsage([{ ...claude, status: "error" }], "claude")).toEqual(absent);
  expect(selectUsage([{ ...claude, status: "unavailable" }], "claude")).toEqual(absent);
});

it("never selects windows by display labels", () => {
  expect(selectUsage([{ ...claude, windows: [{ ...claude.windows[0], id: "other" }] }], "claude")).toEqual({ account: claude.displayName, session: null, weekly: null });
});

it("normalizes optional metrics without losing a valid reset or zero percentage", () => {
  expect(selectUsage([{ ...claude, windows: [{ id: "five_hour", label: "Session", usedPct: 0 }, { id: "weekly", label: "Weekly", usedPct: NaN, resetsAt: "2026-11-05T00:00:00Z" }] }], "claude")).toEqual({ account: claude.displayName, session: { usedPct: 0, resetsAt: null }, weekly: { usedPct: null, resetsAt: "2026-11-05T00:00:00Z" } });
});
