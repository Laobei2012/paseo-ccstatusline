import type { AgentSnapshotPayload as PaseoAgent, ListProviderModelsResponseMessage, ProviderUsageListResponseMessage } from "@getpaseo/protocol/messages";
import type { AgentFacts } from "../shared/facts";
import type { FactsOutput, SettingsOutput } from "../shared/rpc";
import type { StatusSettings } from "../shared/settings";
import { nextSpeed, type TokenSample } from "../shared/speed";
import { contextPercent, pillLabel } from "../shared/summary";
import { selectUsage } from "../shared/usage";
import { lastSkill, type TimelineItem } from "../shared/skills";
import { buildLines, hoverText, type Segment } from "../shared/widgets";

type PaseoProviderModelsResult = ListProviderModelsResponseMessage["payload"];
type PaseoProviderUsageResult = ProviderUsageListResponseMessage["payload"];

export type AgentRecord = Pick<PaseoAgent, "id" | "cwd" | "provider" | "workspaceId" | "model" | "status" |
  "archivedAt" | "lastUsage" | "runtimeInfo" | "thinkingOptionId"> & { title?: string | null };
export type AgentView = {
  label: string; title: string; usageAccount: string | null; contextPercent: number | null;
  lines: Segment[][]; hiddenTypes: string[]; settingsError: string | null;
  agentTitle: string | null; powerline: boolean; globalBold: boolean;
};
export type StatusStore = {
  setAgents(agents: AgentRecord[]): void;
  upsertAgent(agent: AgentRecord): void;
  removeAgent(agentId: string): void;
  getView(agentId: string): AgentView | null;
  subscribe(listener: () => void): () => void;
  openPopover(agentId: string): () => void;
  stop(): void;
};
type Dependencies = {
  readSettings(): Promise<SettingsOutput>;
  readFacts(input: { cwd: string; provider: string }): Promise<FactsOutput>;
  listUsage(): Promise<PaseoProviderUsageResult>;
  listModels(provider: string): Promise<PaseoProviderModelsResult>;
  now(): number;
  readTimeline(agentId: string): Promise<TimelineItem[]>;
};
type Directory = { timer: ReturnType<typeof setInterval> | null; pending: boolean; value: FactsOutput | null; at: number; attemptedAt: number; providers: Set<string>; refreshRequested: boolean };
type AgentState = { agent: AgentRecord; sample: TokenSample | null; speed: AgentFacts["speed"] };
type OpenPopover = { timer: ReturnType<typeof setInterval>; readers: number; pending: boolean };

export function createStatusStore(deps: Dependencies): StatusStore {
  const agents = new Map<string, AgentState>();
  const views = new Map<string, AgentView>();
  const directories = new Map<string, Directory>();
  const models = new Map<string, PaseoProviderModelsResult>();
  const modelRequests = new Set<string>();
  const modelRetryAt = new Map<string, number>();
  const listeners = new Set<() => void>();
  const popovers = new Map<string, OpenPopover>();
  const skills = new Map<string, { label: string; at: number; provider: string }>();
  let settings: StatusSettings | null = null;
  let settingsError: string | null = null;
  let settingsPending = false;
  let settingsTimer: ReturnType<typeof setInterval> | null = null;
  let usage: PaseoProviderUsageResult | null = null;
  let usageAt = -Infinity;
  let usageAttemptedAt = -Infinity;
  let usageTimer: ReturnType<typeof setInterval> | null = null;
  let usageGeneration = 0;
  let usagePending = false;
  let notification: ReturnType<typeof setTimeout> | null = null;
  let speedExpiry: ReturnType<typeof setTimeout> | null = null;
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
      speed: state.sample && deps.now() - state.sample.atMs <= 10000 ? speed : { input: null, output: null, total: null },
      usageAccount: selected.account, session: selected.session, weekly: selected.weekly,
      thinking: agent.runtimeInfo?.thinkingOptionId ?? agent.thinkingOptionId ?? null,
      skill: skills.get(agent.id)?.provider === agent.provider && deps.now() - skills.get(agent.id)!.at < 300000 ? skills.get(agent.id)!.label : null,
      outputStyle: agent.provider === "claude" ? remote?.outputStyle ?? null : null,
    };
    const content = settings ? buildLines(settings, facts, new Date(deps.now())) : { lines: [], hiddenTypes: [] };
    return { ...content, label: pillLabel(facts), title: hoverText(content.lines, facts.usageAccount),
      contextPercent: contextPercent(facts), usageAccount: facts.usageAccount, settingsError,
      agentTitle: agent.title ?? null, powerline: settings?.powerline.enabled ?? false, globalBold: settings?.globalBold ?? false };
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
      if (speedExpiry !== null) { clearTimeout(speedExpiry); speedExpiry = null; }
      let expiresAt = Infinity;
      for (const state of agents.values()) {
        const deadline = (state.sample?.atMs ?? -Infinity) + 10001;
        if (deadline > deps.now() && Object.values(state.speed).some((value) => value !== null)) expiresAt = Math.min(expiresAt, deadline);
      }
      if (Number.isFinite(expiresAt)) speedExpiry = setTimeout(schedule, expiresAt - deps.now());
    }, 1000);
  }

  async function pollFacts(cwd: string, directory: Directory, force = false) {
    if (stopped) return;
    if (directory.pending) { if (force) directory.refreshRequested = true; return; }
    if (!force && deps.now() - directory.attemptedAt < 30000) return;
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
      if (!stopped && directory.timer !== null && directory.refreshRequested) {
        directory.refreshRequested = false;
        void pollFacts(cwd, directory, true);
      }
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
    if (modelRequests.has(provider) || deps.now() < (modelRetryAt.get(provider) ?? -Infinity)) return;
    modelRequests.add(provider);
    try {
      const result = await deps.listModels(provider);
      if (!stopped) { models.set(provider, result); if (agents.size) schedule(); }
    } catch {
      modelRequests.delete(provider);
      modelRetryAt.set(provider, deps.now() + 60000);
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
      const directory: Directory = directories.get(cwd) ?? { timer: null, pending: false, value: null, at: -Infinity, attemptedAt: -Infinity, providers: new Set(), refreshRequested: false };
      const providers = new Set([...agents.values()].filter(({ agent }) => agent.cwd === cwd).map(({ agent }) => agent.provider));
      const gainedProvider = directory.providers.size > 0 && [...providers].some((provider) => !directory.providers.has(provider));
      directory.providers = providers;
      const starting = directory.timer === null;
      if (starting) directory.timer = setInterval(() => { schedule(); void pollFacts(cwd, directory); }, 30000);
      directories.set(cwd, directory);
      if (starting || gainedProvider) void pollFacts(cwd, directory, gainedProvider);
    }
    if (agents.size && usageTimer === null) {
      usageTimer = setInterval(() => { schedule(); void pollUsage(); }, 60000);
      void pollUsage();
    } else if (!agents.size && usageTimer !== null) {
      clearInterval(usageTimer); usageTimer = null;
      usageGeneration++; usagePending = false;
    }
    for (const { agent } of agents.values()) void loadModels(agent.provider);
    if (agents.size && settingsTimer === null) settingsTimer = setInterval(() => { void pollSettings(); }, 30000);
    else if (!agents.size && settingsTimer !== null) { clearInterval(settingsTimer); settingsTimer = null; }
  }

  function put(agent: AgentRecord) {
    const previous = agents.get(agent.id);
    const running = agent.status === "running";
    const sample: TokenSample = { atMs: deps.now(), input: agent.lastUsage?.inputTokens ?? null, output: agent.lastUsage?.outputTokens ?? null, running };
    if (previous?.sample && previous.sample.input === sample.input && previous.sample.output === sample.output && previous.sample.running === running) {
      agents.set(agent.id, { ...previous, agent });
      return;
    }
    const result = nextSpeed(previous?.sample ?? null, sample, running);
    agents.set(agent.id, { agent, ...result });
  }

  async function pollSettings() {
    if (stopped || settingsPending) return;
    settingsPending = true;
    try {
      const result = await deps.readSettings();
      if (stopped) return;
      if (result.ok) { settings = result.settings; settingsError = null; }
      else { settings = null; settingsError = `${result.path}: ${result.reason}`; }
    } catch {
      if (stopped) return;
      settingsError = "Unable to read ccstatusline settings";
      console.error("ccstatusline settings read failed");
    } finally {
      settingsPending = false;
      if (!stopped && agents.size) schedule();
    }
  }
  void pollSettings();

  async function refreshPopover(id: string, popover: OpenPopover) {
    const state = agents.get(id);
    if (stopped || !state || popovers.get(id) !== popover) return;
    void pollSettings();
    const directory = directories.get(state.agent.cwd);
    if (directory) void pollFacts(state.agent.cwd, directory, true);
    void pollUsage();
    schedule();
    if (popover.pending || state.agent.provider !== "claude") return;
    popover.pending = true;
    try {
      const items = await deps.readTimeline(id);
      if (stopped || popovers.get(id) !== popover || agents.get(id)?.agent.provider !== state.agent.provider) return;
      const label = lastSkill(items, state.agent.provider) ?? skills.get(id)?.label;
      if (label) skills.set(id, { label, at: deps.now(), provider: state.agent.provider });
      schedule();
    } catch {
      if (!stopped && popovers.get(id) === popover) console.error("ccstatusline skill timeline refresh failed");
    } finally { popover.pending = false; }
  }

  function closePopover(id: string) {
    const popover = popovers.get(id);
    if (popover) clearInterval(popover.timer);
    popovers.delete(id);
  }

  const store: StatusStore = {
    setAgents(next) {
      if (stopped) return;
      const eligible = next.filter((agent) => agent.workspaceId && !agent.archivedAt);
      const ids = new Set(eligible.map((agent) => agent.id));
      for (const id of agents.keys()) if (!ids.has(id)) { agents.delete(id); views.delete(id); skills.delete(id); closePopover(id); membershipChanged = true; }
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
      skills.delete(id); closePopover(id);
      syncPolling(); schedule();
    },
    getView: (id) => views.get(id) ?? null,
    subscribe(listener) { if (stopped) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    openPopover(id) {
      if (stopped || !agents.has(id)) return () => {};
      let popover = popovers.get(id);
      if (popover) popover.readers++;
      else {
        popover = { timer: setInterval(() => { void refreshPopover(id, popover!); }, 5000), readers: 1, pending: false };
        popovers.set(id, popover);
        void refreshPopover(id, popover);
      }
      let closed = false;
      return () => {
        if (closed) return;
        closed = true;
        if (popovers.get(id) === popover && --popover.readers === 0) closePopover(id);
      };
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (notification !== null) clearTimeout(notification);
      if (speedExpiry !== null) clearTimeout(speedExpiry);
      if (usageTimer !== null) clearInterval(usageTimer);
      if (settingsTimer !== null) clearInterval(settingsTimer);
      for (const directory of directories.values()) if (directory.timer !== null) clearInterval(directory.timer);
      for (const id of popovers.keys()) closePopover(id);
      skills.clear();
      directories.clear(); agents.clear(); views.clear(); listeners.clear();
    },
  };
  return store;
}
