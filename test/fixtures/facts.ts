import type { AgentFacts } from "../../shared/facts";

export const now = new Date("2026-10-31T00:00:00Z");
export const all: AgentFacts = {
  modelLabel: "Opus 5.5", contextUsed: 147000, contextMax: 200000,
  branch: "main", cwd: "/Volumes/WDSN580/src/paseo-work/paseo",
  memory: { used: 7.1 * 1024 ** 3, total: 16 * 1024 ** 3 },
  tokens: { cached: 2800000, input: 52, output: 22700 },
  speed: { input: 0.2, output: 100.4, total: 100.6 },
  usageAccount: "Claude (example account)",
  session: { usedPct: 63, resetsAt: "2026-10-31T02:27:00Z" },
  weekly: { usedPct: 39, resetsAt: "2026-11-04T20:07:00Z" },
  thinking: "high", skill: "superpowers:brainstorming", outputStyle: "simple-english",
};
export const nothing: AgentFacts = {
  modelLabel: null, contextUsed: null, contextMax: null, branch: null, cwd: null,
  memory: null, tokens: { cached: null, input: null, output: null },
  speed: { input: null, output: null, total: null }, usageAccount: null,
  session: null, weekly: null, thinking: null, skill: null, outputStyle: null,
};
