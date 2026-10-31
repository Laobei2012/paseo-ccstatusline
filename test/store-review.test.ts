import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createStatusStore, type AgentRecord, type StatusStore } from "../client/store";
import { parseSettings } from "../shared/settings";

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
    listUsage: vi.fn(async () => ({ requestId: "usage", fetchedAt: "", providers: [] })),
    now: () => Date.now(),
    readTimeline: vi.fn(async () => []),
  };
  if (failFirstSettings) deps.readSettings.mockRejectedValueOnce(new Error("offline"));
  store = createStatusStore(deps);
  return deps;
}

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
