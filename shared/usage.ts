import type { PaseoProviderUsageResult } from "@getpaseo/client";
import { type UsageWindow, isNonNegativeNumber } from "./facts";

export type ProviderUsageEntry = PaseoProviderUsageResult["providers"][number];

function selectWindow(entry: ProviderUsageEntry, id: string): UsageWindow | null {
  const windows = entry.windows.filter((window) => window.id === id);
  if (windows.length !== 1) return null;
  const window = windows[0];
  return {
    usedPct: isNonNegativeNumber(window.usedPct) ? window.usedPct : null,
    resetsAt: typeof window.resetsAt === "string" && Number.isFinite(Date.parse(window.resetsAt)) ? window.resetsAt : null,
  };
}

export function selectUsage(entries: ProviderUsageEntry[], provider: string): {
  account: string | null; session: UsageWindow | null; weekly: UsageWindow | null;
} {
  const matches = entries.filter((entry) => entry.providerId === provider);
  if (matches.length !== 1 || matches[0].status !== "available") return { account: null, session: null, weekly: null };
  const entry = matches[0];
  return { account: entry.displayName || null, session: selectWindow(entry, "five_hour"), weekly: selectWindow(entry, "weekly") };
}
