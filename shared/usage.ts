import type { PaseoUsageReportsResult } from "@getpaseo/client";
import { type UsageWindow, isNonNegativeNumber } from "./facts";

export type AgentUsageEntry = PaseoUsageReportsResult["reports"][number];

type AvailableReport = Extract<AgentUsageEntry["report"], { status: "available" }>;

function selectWindow(report: AvailableReport, id: string): UsageWindow | null {
  const windows = report.windows.filter((window) => window.id === id);
  if (windows.length !== 1) return null;
  const window = windows[0];
  return {
    usedPct: isNonNegativeNumber(window.usedPct) ? window.usedPct : null,
    resetsAt: typeof window.resetsAt === "string" && Number.isFinite(Date.parse(window.resetsAt)) ? window.resetsAt : null,
  };
}

/** Entries must come from the daemon's agent-scoped report request. */
export function selectUsage(entries: AgentUsageEntry[], provider: string): {
  account: string | null; source: string | null; session: UsageWindow | null; weekly: UsageWindow | null;
} {
  // ZeroSub routing does not identify a native subscription account.
  const matches = provider === "zerosub" ? [] : entries;
  if (matches.length !== 1) return { account: null, source: null, session: null, weekly: null };
  const entry = matches[0];
  const report = entry.report;
  if (report.status !== "available") return { account: null, source: null, session: null, weekly: null };
  return { account: entry.account.label || null, source: entry.sourceLabel || null,
    session: selectWindow(report, "five_hour"), weekly: selectWindow(report, "weekly") };
}
