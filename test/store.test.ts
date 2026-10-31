import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStatusStore, type AgentRecord, type StatusStore } from "../client/store";
import { parseSettings } from "../shared/settings";

const settings = parseSettings({ lines: [[
  { type: "model" }, { type: "git-branch" }, { type: "thinking-effort" },
  { type: "input-speed" }, { type: "output-style" }, { type: "skills" },
]] });
const agent = (id: string, cwd = "/repo"): AgentRecord => ({
  id, cwd, workspaceId: "workspace", provider: "claude", model: "raw-model", status: "idle",
  lastUsage: { contextWindowUsedTokens: 74, contextWindowMaxTokens: 100, inputTokens: 10, outputTokens: 20 },
});

describe("status store", () => {
  let store: StatusStore;
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => { store?.stop(); vi.restoreAllMocks(); vi.useRealTimers(); });

  function setup() {
    const deps = {
      readSettings: vi.fn(async () => ({ ok: true as const, settings, path: "/settings" })),
      readFacts: vi.fn(async (_input: { cwd: string; provider: string }) => ({ branch: "main", memory: null, outputStyle: "simple" })),
      listUsage: vi.fn(async (_agentId?: string) => ({ requestId: "usage",
        reports: [{ id: "claude:primary", sourceId: "claude", sourceLabel: "Claude", account: { label: "Primary" },
          fetchedAt: new Date().toISOString(), report: { status: "available" as const,
          windows: [{ id: "five_hour", label: "Session", usedPct: 63 }, { id: "weekly", label: "Weekly", usedPct: 39 }] } }] })),
      listModels: vi.fn(async (provider: string) => ({ provider, requestId: "models", fetchedAt: new Date().toISOString(),
        models: [{ provider, id: "raw-model", label: "Friendly model" }] })),
      now: () => Date.now(),
      readTimeline: vi.fn(async (_agentId: string): Promise<import("../shared/skills").TimelineItem[]> => [{
        type: "tool_call", callId: "skill", name: "Skill", status: "completed", error: null,
        detail: { type: "plain_text", label: "paseo" },
      }]),
    };
    store = createStatusStore(deps);
    return deps;
  }
  const flush = () => vi.advanceTimersByTimeAsync(1000);

  it("keeps all five configured rows and the attributed account for two same-provider agents", async () => {
    const deps = setup();
    const fiveRows = parseSettings({ lines: [
      [{ type: "model" }], [{ type: "current-working-dir" }], [{ type: "tokens-input" }],
      [{ type: "session-usage" }, { type: "weekly-usage" }], [{ type: "thinking-effort" }],
    ] });
    deps.readSettings.mockResolvedValue({ ok: true, settings: fiveRows, path: "/settings" });
    const primary = (await deps.listUsage()).reports[0];
    const accounts = [primary, { ...primary, id: "claude:secondary", account: { label: "Secondary" } }];
    deps.listUsage.mockImplementation(async (id) => ({ requestId: "usage", fetchedAt: "",
      reports: id === undefined ? accounts : [accounts[id === "a" ? 0 : 1]],
    }));
    store.setAgents([{ ...agent("a"), thinkingOptionId: "high" }, { ...agent("b"), thinkingOptionId: "high" }]);
    await vi.advanceTimersByTimeAsync(31000);
    expect(store.getView("a")?.lines.filter((line) => line.length)).toHaveLength(5);
    expect(store.getView("a")?.usageAccount).toBe("Primary");
    expect(store.getView("b")?.usageAccount).toBe("Secondary");
    expect(deps.listUsage).toHaveBeenCalledWith("a");
    expect(deps.listUsage).toHaveBeenCalledWith("b");
  });

  it("replaces the directory on reconnect snapshots", async () => {
    setup();
    store.setAgents([agent("old"), agent("kept")]);
    await flush();
    store.setAgents([agent("kept"), agent("new")]);
    await flush();
    expect(store.getView("old")).toBeNull();
    expect(store.getView("kept")).not.toBeNull();
    expect(store.getView("new")).not.toBeNull();
  });

  it("ignores updates after removal without restarting timers", async () => {
    const deps = setup();
    store.setAgents([agent("a")]);
    await flush();
    store.removeAgent("a");
    await flush();
    const calls = deps.readFacts.mock.calls.length;
    store.upsertAgent(agent("a"));
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60000);
    expect(store.getView("a")).toBeNull();
    expect(deps.readFacts).toHaveBeenCalledTimes(calls);
  });

  it("coalesces many updates into one notification per second", async () => {
    setup(); store.setAgents([agent("a")]); await flush();
    const listener = vi.fn(); store.subscribe(listener);
    for (let used = 1; used <= 50; used++) {
      store.upsertAgent({ ...agent("a"), lastUsage: { contextWindowUsedTokens: used, contextWindowMaxTokens: 100 } });
    }
    expect(listener).not.toHaveBeenCalled();
    await flush();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getView("a")?.label).toBe("50% · 63% · 39%");
  });

  it("keeps the same snapshot and stays silent for unchanged views", async () => {
    setup(); store.setAgents([agent("a")]); await flush();
    const view = store.getView("a");
    const listener = vi.fn(); store.subscribe(listener);
    store.upsertAgent(agent("a")); await flush();
    expect(listener).not.toHaveBeenCalled();
    expect(store.getView("a")).toBe(view);
  });

  it("shares facts by cwd every 30 seconds and usage per agent every 60 seconds", async () => {
    const deps = setup();
    store.setAgents([agent("a"), agent("b"), agent("c", "/other")]);
    await flush();
    expect(deps.readFacts).toHaveBeenCalledTimes(2);
    expect(deps.listUsage).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(29000);
    expect(deps.readFacts).toHaveBeenCalledTimes(4);
    expect(deps.listUsage).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(30000);
    expect(deps.readFacts).toHaveBeenCalledTimes(6);
    expect(deps.listUsage).toHaveBeenCalledTimes(6);
  });

  it("keeps failed facts for five minutes, then hides them", async () => {
    const deps = setup(); vi.spyOn(console, "error").mockImplementation(() => {});
    store.setAgents([agent("a")]); await flush();
    deps.readFacts.mockRejectedValue(new Error("offline"));
    await vi.advanceTimersByTimeAsync(298000);
    expect(store.getView("a")?.title).toContain("⎇ main");
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.getView("a")?.title).not.toContain("⎇ main");
    expect(console.error).toHaveBeenCalled();
  });

  it("keeps polling limits when agents leave and return", async () => {
    const deps = setup();
    store.setAgents([agent("a")]); await flush();
    store.setAgents([]); await flush();
    store.setAgents([agent("a")]); await flush();
    expect(deps.readFacts).toHaveBeenCalledTimes(1);
    expect(deps.listUsage).toHaveBeenCalledTimes(2);
    expect(store.getView("a")?.label).toBe("74% · 63% · 39%");
  });

  it("uses SDK context, model labels, account attribution and runtime thinking", async () => {
    setup(); store.setAgents([{ ...agent("a"), thinkingOptionId: "low",
      runtimeInfo: { provider: "claude", sessionId: null, thinkingOptionId: "high" } }]); await flush();
    const view = store.getView("a")!;
    expect(view.label).toBe("74% · 63% · 39%");
    expect(view.contextPercent).toBe(74);
    expect(view.usageAccount).toBe("Primary");
    expect(view.title).toBe("Usage: Primary\nModel: Friendly model | ⎇ main | Thinking: high | Style: simple");
    expect(view.title).not.toContain("Skill:");
  });

  it("does not estimate speed across an idle-to-running transition", async () => {
    setup(); store.setAgents([agent("a")]); await flush();
    store.upsertAgent({ ...agent("a"), status: "running", lastUsage: { inputTokens: 100, outputTokens: 100 } });
    await flush();
    expect(store.getView("a")?.title).not.toContain("t/s");
    store.upsertAgent({ ...agent("a"), status: "running", lastUsage: { inputTokens: 200, outputTokens: 200 } });
    await flush();
    expect(store.getView("a")?.title).toContain("In: 100.0 t/s");
    store.upsertAgent({ ...agent("a"), status: "idle" }); await flush();
    expect(store.getView("a")?.title).not.toContain("t/s");
  });

  it("releases timers for unused directories and on stop", async () => {
    const deps = setup(); store.setAgents([agent("a"), agent("b", "/other")]); await flush();
    store.removeAgent("b"); await flush();
    await vi.advanceTimersByTimeAsync(30000);
    expect(deps.readFacts.mock.calls.filter(([input]) => input.cwd === "/other")).toHaveLength(1);
    store.stop();
    expect(vi.getTimerCount()).toBe(0);
    store.setAgents([agent("new")]); store.upsertAgent(agent("a"));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("discards late RPC results after removal and stop", async () => {
    const deps = setup();
    let resolve!: (facts: { branch: string; memory: null; outputStyle: string }) => void;
    deps.readFacts.mockImplementation(() => new Promise((done) => { resolve = done; }));
    store.setAgents([agent("a")]); await flush();
    store.removeAgent("a"); await flush(); store.stop();
    resolve({ branch: "late", memory: null, outputStyle: "late" });
    await Promise.resolve(); await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    expect(store.getView("a")).toBeNull();
  });

  it("reads skills only while the popover is open and retains the known skill in hover", async () => {
    const deps = setup(); store.setAgents([agent("a")]); await flush();
    expect(deps.readTimeline).not.toHaveBeenCalled();
    const close = store.openPopover("a"); await flush();
    expect(deps.readTimeline).toHaveBeenCalledTimes(1);
    expect(store.getView("a")?.title).toContain("Skill: paseo");
    await vi.advanceTimersByTimeAsync(5000);
    expect(deps.readTimeline).toHaveBeenCalledTimes(2);
    expect(deps.readSettings).toHaveBeenCalledTimes(3);
    close(); await vi.advanceTimersByTimeAsync(10000);
    expect(deps.readTimeline).toHaveBeenCalledTimes(2);
    expect(store.getView("a")?.title).toContain("Skill: paseo");
    const closeAgain = store.openPopover("a"); await flush();
    store.stop();
    expect(vi.getTimerCount()).toBe(0);
    closeAgain();
    await vi.advanceTimersByTimeAsync(10000);
    expect(deps.readTimeline).toHaveBeenCalledTimes(3);
  });

  it("never fetches a Codex timeline for skills", async () => {
    const deps = setup(); store.setAgents([{ ...agent("a"), provider: "codex" }]); await flush();
    const close = store.openPopover("a"); await vi.advanceTimersByTimeAsync(11000);
    expect(deps.readTimeline).not.toHaveBeenCalled();
    expect(store.getView("a")?.title).not.toContain("Skill:");
    close();
  });

  it("ignores a timeline result after close and clears open-popover timers on removal", async () => {
    const deps = setup(); store.setAgents([agent("a")]); await flush();
    let resolve!: (items: import("../shared/skills").TimelineItem[]) => void;
    deps.readTimeline.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const close = store.openPopover("a"); close();
    await flush();
    resolve([{ type: "tool_call", callId: "late", name: "Skill", status: "completed", error: null,
      detail: { type: "plain_text", label: "late-skill" } }]);
    await flush();
    expect(store.getView("a")?.title).not.toContain("late-skill");
    store.openPopover("a"); store.removeAgent("a"); await flush();
    expect(vi.getTimerCount()).toBe(0);
  });
});
