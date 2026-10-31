export type UsageWindow = { usedPct: number | null; resetsAt: string | null };

export type AgentFacts = {
  modelLabel: string | null;
  contextUsed: number | null;
  contextMax: number | null;
  branch: string | null;
  cwd: string | null;
  memory: { used: number; total: number } | null;
  tokens: { cached: number | null; input: number | null; output: number | null };
  speed: { input: number | null; output: number | null; total: number | null };
  usageAccount: string | null;
  session: UsageWindow | null;
  weekly: UsageWindow | null;
  thinking: string | null;
  skill: string | null;
  outputStyle: string | null;
};

export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
