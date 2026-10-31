import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createStatusStore, type AgentRecord, type StatusStore } from "../client/store";
import { parseSettings } from "../shared/settings";
import type { PaseoUsageReportsResult } from "@getpaseo/client";

let store: StatusStore;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { store.stop(); vi.restoreAllMocks(); vi.useRealTimers(); });
const agent = (id = "a", provider = "claude"): AgentRecord => ({
  id, provider, cwd: "/repo", workspaceId: "workspace", model: "model", status: "running",
  lastUsage: { inputTokens: 0, outputTokens: 100 },
});
const settings = (type: string) => parseSettings({ lines: [[{ type }]] });
function setup(failFirstSettings = false, widget = "output-speed") {
  const deps = {
    readSettings: vi.fn(async () => ({ ok: true as const, settings: settings(widget), path: "/settings" })),
    readFacts: vi.fn(async ({ provider }: { cwd: string; provider: string }) => ({ branch: null, memory: null, outputStyle: provider === "claude" ? "simple" : null })),
    listModels: vi.fn(async (provider: string) => ({ provider, requestId: "models", fetchedAt: "", models: [] })),
    listUsage: vi.fn(async (_id: string): Promise<PaseoUsageReportsResult> => ({ requestId: "usage", reports: [] })),
    now: () => Date.now(),
    readTimeline: vi.fn(async () => []),
  };
  if (failFirstSettings) deps.readSettings.mockRejectedValueOnce(new Error("offline"));
  store = createStatusStore(deps);
  return deps;
}

function attributedUsage(label: string): PaseoUsageReportsResult {
  return { requestId: "usage", reports: [{ id: `claude:${label}`, sourceId: "claude", sourceLabel: "Claude",
    account: { label }, fetchedAt: "", report: { status: "available", windows: [{ id: "five_hour", label: "Session", usedPct: 25 }] } }] };
}

it("loads a newly added agent while another account request is pending and shares its hover/press polling limit", async () => {
  const deps = setup();
  deps.listUsage.mockImplementation((id) => id === "a" ? new Promise(() => {}) : Promise.resolve(attributedUsage("B")));
  store.setAgents([agent()]);
  store.setAgents([agent(), agent("b")]);
  await vi.advanceTimersByTimeAsync(1000);
  expect(deps.listUsage.mock.calls).toEqual([["a"], ["b"]]);
  expect(store.getView("b")?.usageAccount).toBe("B");
  const hover = store.openPopover("b");
  const press = store.openPopover("b");
  await vi.advanceTimersByTimeAsync(58000);
  expect(deps.listUsage).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1000);
  expect(deps.listUsage).toHaveBeenCalledTimes(3);
  hover(); press();
});

it("rejects a previous session's late account response after the same agent switches accounts", async () => {
  const deps = setup();
  let finish = (_value: PaseoUsageReportsResult) => {};
  const pending = new Promise<PaseoUsageReportsResult>((resolve) => { finish = resolve; });
  deps.listUsage.mockReturnValueOnce(pending).mockResolvedValue(attributedUsage("B"));
  store.setAgents([{ ...agent(), runtimeInfo: { provider: "claude", sessionId: "session-a" } }]);
  store.upsertAgent({ ...agent(), runtimeInfo: { provider: "claude", sessionId: "session-b" } });
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.usageAccount).toBe("B");
  finish(attributedUsage("A"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.usageAccount).toBe("B");
});

it("invalidates a pending account request for a new turn on the same persisted thread", async () => {
  const deps = setup();
  let finish = (_value: PaseoUsageReportsResult) => {};
  deps.listUsage.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValue(attributedUsage("B"));
  const thread = { ...agent(), runtimeInfo: { provider: "claude", sessionId: "same-thread" } };
  store.setAgents([{ ...thread, activeTurn: { turnId: "turn-a", startedAt: null } }]);
  store.upsertAgent({ ...thread, activeTurn: { turnId: "turn-b", startedAt: null } });
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.usageAccount).toBe("B");
  finish(attributedUsage("A"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.usageAccount).toBe("B");
});

it("refreshes a same-thread account change within the polling interval without an observable lifecycle change", async () => {
  const deps = setup();
  deps.listUsage.mockResolvedValueOnce(attributedUsage("A")).mockResolvedValue(attributedUsage("B"));
  store.setAgents([agent()]);
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.usageAccount).toBe("A");
  await vi.advanceTimersByTimeAsync(60000);
  expect(store.getView("a")?.usageAccount).toBe("B");
});

it("refreshes an off-grid agent at its own sixty-second deadline", async () => {
  const deps = setup();
  deps.listUsage.mockResolvedValue(attributedUsage("A"));
  store.setAgents([agent()]);
  await vi.advanceTimersByTimeAsync(10000);
  store.setAgents([agent(), agent("b")]);
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("b")?.usageAccount).toBe("A");
  deps.listUsage.mockResolvedValue(attributedUsage("B"));
  await vi.advanceTimersByTimeAsync(58000);
  expect(store.getView("b")?.usageAccount).toBe("A");
  await vi.advanceTimersByTimeAsync(2000);
  expect(store.getView("b")?.usageAccount).toBe("B");
});

it("revalidates immediately on new turns even inside the steady-state polling interval", async () => {
  const deps = setup();
  deps.listUsage.mockResolvedValue(attributedUsage("A"));
  store.setAgents([{ ...agent(), activeTurn: { turnId: "a", startedAt: null } }]);
  await vi.advanceTimersByTimeAsync(1000);
  deps.listUsage.mockResolvedValue(attributedUsage("B"));
  store.upsertAgent({ ...agent(), activeTurn: { turnId: "b", startedAt: null } });
  await vi.advanceTimersByTimeAsync(1000);
  expect(deps.listUsage).toHaveBeenCalledTimes(2);
  expect(store.getView("a")?.usageAccount).toBe("B");
});

it("does not query unloaded closed agents and invalidates their pending account on close", async () => {
  const deps = setup();
  store.setAgents([{ ...agent(), status: "closed" }]);
  await vi.advanceTimersByTimeAsync(60000);
  expect(deps.listUsage).not.toHaveBeenCalled();
  let finish = (_value: PaseoUsageReportsResult) => {};
  deps.listUsage.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValue(attributedUsage("B"));
  store.upsertAgent(agent());
  store.upsertAgent({ ...agent(), status: "closed" });
  finish(attributedUsage("A"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.usageAccount).toBeNull();
  store.upsertAgent(agent());
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.usageAccount).toBe("B");
});

it("rejects a removed registration's pending usage after the same agent ID returns", async () => {
  const deps = setup();
  let finish = (_value: PaseoUsageReportsResult) => {};
  deps.listUsage.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValue(attributedUsage("B"));
  store.setAgents([agent()]);
  store.removeAgent("a");
  store.setAgents([agent()]);
  await vi.advanceTimersByTimeAsync(1000);
  finish(attributedUsage("A"));
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.usageAccount).toBe("B");
  store.stop();
  expect(vi.getTimerCount()).toBe(0);
});

it("clears previous account and windows when attribution disappears or refresh fails", async () => {
  const deps = setup();
  deps.listUsage.mockResolvedValue(attributedUsage("A"));
  store.setAgents([agent()]);
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.usageAccount).toBe("A");
  deps.listUsage.mockResolvedValue({ requestId: "usage", reports: [] });
  await vi.advanceTimersByTimeAsync(60000);
  expect(store.getView("a")?.usageAccount).toBeNull();
  deps.listUsage.mockResolvedValue(attributedUsage("B"));
  await vi.advanceTimersByTimeAsync(60000);
  expect(store.getView("a")?.usageAccount).toBe("B");
  vi.spyOn(console, "error").mockImplementation(() => {});
  deps.listUsage.mockRejectedValue(new Error("offline"));
  await vi.advanceTimersByTimeAsync(60000);
  expect(store.getView("a")?.usageAccount).toBeNull();
  expect(store.getView("a")?.label).toBe("-- · -- · --");
  await vi.advanceTimersByTimeAsync(58000);
  expect(deps.listUsage).toHaveBeenCalledTimes(4);
});

it("review: reloads saved settings from one shared 30-second timer", async () => {
  const deps = setup(); store.setAgents([agent(), agent("b")]);
  await vi.advanceTimersByTimeAsync(1000);
  deps.readSettings.mockResolvedValue({ ok: true, settings: settings("model"), path: "/settings" });
  await vi.advanceTimersByTimeAsync(30000);
  expect(deps.readSettings).toHaveBeenCalledTimes(2);
  expect(store.getView("a")?.title).toBe("Model: model");
  expect(store.getView("b")?.title).toBe("Model: model");
});

it("review: recovers from a first settings RPC failure", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  setup(true);
  store.setAgents([agent()]); await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.settingsError).not.toBeNull();
  await vi.advanceTimersByTimeAsync(30000);
  expect(store.getView("a")?.settingsError).toBeNull();
});

it("review: unchanged-count upserts preserve the speed measurement interval", async () => {
  setup(); store.setAgents([agent()]); await vi.advanceTimersByTimeAsync(9000);
  store.upsertAgent({ ...agent(), title: "renamed" } as AgentRecord);
  await vi.advanceTimersByTimeAsync(1000);
  store.upsertAgent({ ...agent(), lastUsage: { inputTokens: 0, outputTokens: 1100 } });
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.title).toBe("Out: 100.0 t/s");
});

it("review: hides a stalled running agent's speed after ten seconds without changed counts", async () => {
  setup(); store.setAgents([agent()]); await vi.advanceTimersByTimeAsync(1000);
  store.upsertAgent({ ...agent(), lastUsage: { inputTokens: 0, outputTokens: 200 } });
  await vi.advanceTimersByTimeAsync(1000);
  expect(store.getView("a")?.title).toBe("Out: 100.0 t/s");
  await vi.advanceTimersByTimeAsync(11000);
  expect(store.getView("a")?.title).not.toContain("t/s");
});

it("review: backs off failed model lists for 60 seconds", async () => {
  const deps = setup(); vi.spyOn(console, "error").mockImplementation(() => {});
  deps.listModels.mockRejectedValue(new Error("offline"));
  store.setAgents([agent()]); await vi.advanceTimersByTimeAsync(1000);
  for (let i = 0; i < 10; i++) { store.upsertAgent(agent()); await vi.advanceTimersByTimeAsync(1000); }
  expect(deps.listModels).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(49000);
  store.upsertAgent(agent()); await vi.advanceTimersByTimeAsync(1000);
  expect(deps.listModels).toHaveBeenCalledTimes(2);
});

it("review: fetches output style immediately when Claude joins a Codex directory", async () => {
  const deps = setup(false, "output-style");
  store.setAgents([agent("codex", "codex")]); await vi.advanceTimersByTimeAsync(1000);
  store.setAgents([agent("codex", "codex"), agent("claude")]); await vi.advanceTimersByTimeAsync(1000);
  expect(deps.readFacts).toHaveBeenCalledTimes(2);
  expect(store.getView("claude")?.title).toBe("Style: simple");
});
