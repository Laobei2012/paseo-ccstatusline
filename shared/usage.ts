import type { UsageReportEntry } from "@getpaseo/protocol/messages";
import { type UsageWindow, isNonNegativeNumber } from "./facts";

function selectWindow(report: Extract<UsageReportEntry["report"], { status: "available" }>, id: string): UsageWindow | null {
  const windows = report.windows.filter((window) => window.id === id);
  if (windows.length !== 1) return null;
  const window = windows[0];
  return {
    usedPct: isNonNegativeNumber(window.usedPct) ? window.usedPct : null,
    resetsAt: typeof window.resetsAt === "string" && Number.isFinite(Date.parse(window.resetsAt)) ? window.resetsAt : null,
  };
}

export function selectUsage(entries: UsageReportEntry[]): {
  account: string | null; session: UsageWindow | null; weekly: UsageWindow | null;
} {
  // Agent-scoped attribution is authoritative even when the usage source differs from the harness.
  const entry = entries.length === 1 ? entries[0] : null;
  const report = entry?.report;
  if (!entry || report?.status !== "available") return { account: null, session: null, weekly: null };
  return { account: entry.account.label || null, session: selectWindow(report, "five_hour"), weekly: selectWindow(report, "weekly") };
}
