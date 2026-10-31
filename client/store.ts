import type { PaseoAgent, PaseoProviderModelsResult, PaseoProviderUsageResult } from "@getpaseo/client";
import type { AgentFacts } from "../shared/facts";
import type { FactsOutput, SettingsOutput } from "../shared/rpc";
import type { StatusSettings } from "../shared/settings";
import { nextSpeed, type TokenSample } from "../shared/speed";
import { contextPercent, pillLabel } from "../shared/summary";
import { selectUsage } from "../shared/usage";
import { buildLines, hoverText, type Segment } from "../shared/widgets";

export type AgentRecord = Pick<PaseoAgent, "id" | "cwd" | "provider" | "workspaceId" | "model" | "status" |
  "archivedAt" | "lastUsage" | "runtimeInfo" | "thinkingOptionId">;
export type AgentView = {
  label: string; title: string; usageAccount: string | null; contextPercent: number | null;
  lines: Segment[][]; hiddenTypes: string[]; settingsError: string | null;
};
export type StatusStore = {
  setAgents(agents: AgentRecord[]): void;
  upsertAgent(agent: AgentRecord): void;
  removeAgent(agentId: string): void;
  getView(agentId: string): AgentView | null;
  subscribe(listener: () => void): () => void;
  stop(): void;
};
type Dependencies = {
  readSettings(): Promise<SettingsOutput>;
  readFacts(input: { cwd: string; provider: string }): Promise<FactsOutput>;
  listUsage(): Promise<PaseoProviderUsageResult>;
  listModels(provider: string): Promise<PaseoProviderModelsResult>;
  now(): number;
};
type Directory = { timer: ReturnType<typeof setInterval> | null; pending: boolean; value: FactsOutput | null; at: number; attemptedAt: number };
type AgentState = { agent: AgentRecord; sample: TokenSample | null; speed: AgentFacts["speed"] };

export function createStatusStore(deps: Dependencies): StatusStore {
  const agents = new Map<string, AgentState>();
  const views = new Map<string, AgentView>();
  const directories = new Map<string, Directory>();
  const models = new Map<string, PaseoProviderModelsResult>();
  const modelRequests = new Set<string>();
  const listeners = new Set<() => void>();
  let settings: StatusSettings | null = null;
  let settingsError: string | null = null;
  let usage: PaseoProviderUsageResult | null = null;
  let usageAt = -Infinity;
  let usageAttemptedAt = -Infinity;
  let usageTimer: ReturnType<typeof setInterval> | null = null;
  let usageGeneration = 0;
  let usagePending = false;
  let notification: ReturnType<typeof setTimeout> | null = null;
  let membershipChanged = false;
  let stopped = false;

  function buildView(state: AgentState): AgentView {
    const { agent, speed } = state;
    const directory = directories.get(agent.cwd);
    const remote = directory && deps.now() - directory.at < 300000 ? directory.value : null;
    const selected = selectUsage(usage && deps.now() - usageAt < 300000 ? usage.providers : [], agent.provider);
    const model = agent.runtimeInfo?.model ?? agent.model;
    const modelLabel = models.get(agent.provider)?.models?.find((entry) => entry.id === model || entry.aliases?.includes(model ?? ""))?.label ?? model;
    const facts: AgentFacts = {
      modelLabel, contextUsed: agent.lastUsage?.contextWindowUsedTokens ?? null,
      contextMax: agent.lastUsage?.contextWindowMaxTokens ?? null,
      branch: remote?.branch ?? null, cwd: agent.cwd, memory: remote?.memory ?? null,
      tokens: { cached: agent.lastUsage?.cachedInputTokens ?? null, input: agent.lastUsage?.inputTokens ?? null, output: agent.lastUsage?.outputTokens ?? null },
      speed, usageAccount: selected.account, session: selected.session, weekly: selected.weekly,
      thinking: agent.runtimeInfo?.thinkingOptionId ?? agent.thinkingOptionId ?? null,
      skill: null, outputStyle: agent.provider === "claude" ? remote?.outputStyle ?? null : null,
    };
    const content = settings ? buildLines(settings, facts, new Date(deps.now())) : { lines: [], hiddenTypes: [] };
    return { ...content, label: pillLabel(facts), title: hoverText(content.lines, facts.usageAccount),
      contextPercent: contextPercent(facts), usageAccount: facts.usageAccount, settingsError };
  }

  function schedule() {
    if (stopped || notification !== null) return;
    notification = setTimeout(() => {
      notification = null;
      let changed = membershipChanged;
      membershipChanged = false;
      for (const [id, state] of agents) {
        const view = buildView(state);
        if (JSON.stringify(view) === JSON.stringify(views.get(id))) continue;
        views.set(id, view);
        changed = true;
      }
      if (changed) for (const listener of listeners) listener();
    }, 1000);
  }

  async function pollFacts(cwd: string, directory: Directory) {
    if (stopped || directory.pending || deps.now() - directory.attemptedAt < 30000) return;
    directory.pending = true;
    // Output style is shared by cwd, but only Claude agents consume it.
    const users = [...agents.values()].filter(({ agent }) => agent.cwd === cwd);
    const provider = users.find(({ agent }) => agent.provider === "claude")?.agent.provider ?? users[0]?.agent.provider;
    if (!provider) { directory.pending = false; return; }
    directory.attemptedAt = deps.now();
    try {
      const value = await deps.readFacts({ cwd, provider });
      if (stopped || directories.get(cwd) !== directory) return;
      directory.value = value;
      directory.at = deps.now();
    } catch {
      if (!stopped && directories.get(cwd) === directory) console.error("ccstatusline facts refresh failed");
    } finally {
      directory.pending = false;
      if (!stopped && directory.timer !== null && directories.get(cwd) === directory) schedule();
    }
  }

  async function pollUsage() {
    if (stopped || usagePending || agents.size === 0 || deps.now() - usageAttemptedAt < 60000) return;
    const generation = usageGeneration;
    usagePending = true;
    usageAttemptedAt = deps.now();
    try {
      const value = await deps.listUsage();
      if (stopped || generation !== usageGeneration) return;
      usage = value;
      usageAt = deps.now();
    } catch {
      if (!stopped && generation === usageGeneration) console.error("ccstatusline usage refresh failed");
    } finally {
      if (!stopped && generation === usageGeneration) { usagePending = false; schedule(); }
    }
  }

  async function loadModels(provider: string) {
    if (modelRequests.has(provider)) return;
    modelRequests.add(provider);
    try {
      const result = await deps.listModels(provider);
      if (!stopped) { models.set(provider, result); if (agents.size) schedule(); }
    } catch {
      modelRequests.delete(provider);
      if (!stopped) console.error("ccstatusline model list failed");
    }
  }

  function syncPolling() {
    const cwds = new Set([...agents.values()].map(({ agent }) => agent.cwd));
    for (const [cwd, directory] of directories) {
      if (cwds.has(cwd)) continue;
      if (directory.timer !== null) clearInterval(directory.timer);
      directory.timer = null;
      if (deps.now() - directory.at >= 300000 && deps.now() - directory.attemptedAt >= 30000) directories.delete(cwd);
    }
    for (const cwd of cwds) {
      const directory: Directory = directories.get(cwd) ?? { timer: null, pending: false, value: null, at: -Infinity, attemptedAt: -Infinity };
      if (directory.timer !== null) continue;
      directory.timer = setInterval(() => { schedule(); void pollFacts(cwd, directory); }, 30000);
      directories.set(cwd, directory);
      void pollFacts(cwd, directory);
    }
    if (agents.size && usageTimer === null) {
      usageTimer = setInterval(() => { schedule(); void pollUsage(); }, 60000);
      void pollUsage();
    } else if (!agents.size && usageTimer !== null) {
      clearInterval(usageTimer); usageTimer = null;
      usageGeneration++; usagePending = false;
    }
    for (const { agent } of agents.values()) void loadModels(agent.provider);
  }

  function put(agent: AgentRecord) {
    const previous = agents.get(agent.id);
    const running = agent.status === "running";
    const sample: TokenSample = { atMs: deps.now(), input: agent.lastUsage?.inputTokens ?? null, output: agent.lastUsage?.outputTokens ?? null, running };
    const result = nextSpeed(previous?.sample ?? null, sample, running);
    agents.set(agent.id, { agent, ...result });
  }

  void deps.readSettings().then((result) => {
    if (stopped) return;
    if (result.ok) { settings = result.settings; settingsError = null; }
    else settingsError = `${result.path}: ${result.reason}`;
    if (agents.size) schedule();
  }).catch(() => {
    if (stopped) return;
    settingsError = "Unable to read ccstatusline settings";
    console.error("ccstatusline settings read failed");
    if (agents.size) schedule();
  });

  const store: StatusStore = {
    setAgents(next) {
      if (stopped) return;
      const eligible = next.filter((agent) => agent.workspaceId && !agent.archivedAt);
      const ids = new Set(eligible.map((agent) => agent.id));
      for (const id of agents.keys()) if (!ids.has(id)) { agents.delete(id); views.delete(id); membershipChanged = true; }
      for (const agent of eligible) {
        if (!agents.has(agent.id)) membershipChanged = true;
        put(agent);
        if (!views.has(agent.id)) views.set(agent.id, buildView(agents.get(agent.id)!));
      }
      syncPolling(); schedule();
    },
    upsertAgent(agent) {
      if (stopped || !agents.has(agent.id)) return;
      if (!agent.workspaceId || agent.archivedAt) { store.removeAgent(agent.id); return; }
      put(agent); syncPolling(); schedule();
    },
    removeAgent(id) {
      if (stopped || !agents.delete(id)) return;
      views.delete(id); membershipChanged = true;
      syncPolling(); schedule();
    },
    getView: (id) => views.get(id) ?? null,
    subscribe(listener) { if (stopped) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    stop() {
      if (stopped) return;
      stopped = true;
      if (notification !== null) clearTimeout(notification);
      if (usageTimer !== null) clearInterval(usageTimer);
      for (const directory of directories.values()) if (directory.timer !== null) clearInterval(directory.timer);
      directories.clear(); agents.clear(); views.clear(); listeners.clear();
    },
  };
  return store;
}
