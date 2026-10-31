import { type AgentFacts, isNonNegativeNumber } from "./facts";

export function contextPercent(facts: AgentFacts): number | null {
  const { contextUsed: used, contextMax: max } = facts;
  if (used === null || !Number.isFinite(used) || !isNonNegativeNumber(max) || max === 0) return null;
  return Math.max(0, Math.min(100, used / max * 100));
}

export function pillLabel(facts: AgentFacts): string {
  return [contextPercent(facts), facts.session?.usedPct, facts.weekly?.usedPct]
    .map((value) => isNonNegativeNumber(value) ? `${Math.round(value)}%` : "--")
    .join(" · ");
}
