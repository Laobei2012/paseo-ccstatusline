import type { PaseoAgentHandle } from "@getpaseo/client";
import type { UsageReportEntry } from "@getpaseo/protocol/messages";

// Temporary bridge for the proposed SDK API. Keep 0.14.0 development dependencies
// until a release includes it; older app SDKs simply leave account usage hidden.
export type AgentUsageResult = {
  requestId: string;
  reports: UsageReportEntry[];
  usageRevision: string | null;
};
type UsageHandle = PaseoAgentHandle & {
  listUsageReports?: () => Promise<AgentUsageResult>;
};

export async function listAgentUsage(handle: PaseoAgentHandle): Promise<AgentUsageResult> {
  const scoped = handle as UsageHandle;
  if (typeof scoped.listUsageReports !== "function") {
    return { requestId: "", reports: [], usageRevision: null };
  }
  return scoped.listUsageReports();
}
