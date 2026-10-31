import { describe, expect, it, vi } from "vitest";
import type { PluginClientContext, PluginComposerPillContribution } from "@getpaseo/plugin/client";
import contribute from "../index.client";
import { reconcilePills, type PillRecord } from "../client/pills";
import type { AgentRecord } from "../client/store";

vi.mock("react-native", () => ({ Text: () => null, View: () => null }));

const agent = (id: string, workspaceId = "workspace"): AgentRecord => ({
  id, workspaceId, cwd: "/repo", provider: "claude", model: null, status: "idle",
});
const record = (workspaceId = "workspace"): PillRecord => ({
  workspaceId, registration: { update() {}, remove() {} }, label: "-- · -- · --", title: "Status",
});

describe("pill reconciliation", () => {
  it("removes missing, archived and workspace-less pills", () => {
    const previous = new Map(["missing", "archived", "detached", "kept"].map((id) => [id, record()]));
    expect(reconcilePills(previous, [
      { ...agent("archived"), archivedAt: "2026-10-30" },
      { ...agent("detached"), workspaceId: undefined }, agent("kept"), agent("new"),
    ])).toEqual({ add: [agent("new")], remove: ["missing", "archived", "detached"] });
  });

  it("replaces pills when a reconnect snapshot has a different directory", () => {
    const previous = new Map([["old", record()]]);
    expect(reconcilePills(previous, [agent("new")])).toEqual({ add: [agent("new")], remove: ["old"] });
  });

  it("moves a pill when its workspace changes and retains unchanged registrations", () => {
    const previous = new Map([["moved", record()], ["kept", record()]]);
    expect(reconcilePills(previous, [agent("moved", "other"), agent("kept")])).toEqual({
      add: [agent("moved", "other")], remove: ["moved"],
    });
  });

  it("owns the subscription, keeps a stable icon and ignores updates after removal", async () => {
    vi.useFakeTimers();
    type Observer = {
      snapshot(value: { entries: { agent: AgentRecord }[] }): void;
      update(value: { type: "agent_update"; payload: { kind: "upsert"; agent: AgentRecord } | { kind: "remove"; agentId: string } }): void;
    };
    let observer!: Observer;
    const unsubscribe = vi.fn();
    const registrations: { update: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }[] = [];
    const add = vi.fn((_pill: PluginComposerPillContribution) => {
      const registration = { update: vi.fn(), remove: vi.fn() };
      registrations.push(registration); return registration;
    });
    const list = vi.fn(async (_options: { subscribe: object; signal: AbortSignal }) => ({
      subscription: { subscribe: (value: Observer) => { observer = value; return unsubscribe; } },
    }));
    const stop = contribute({
      paseo: { agents: { list }, providers: { listUsage: async () => ({ providers: [] }), listModels: async () => ({ models: [] }) } },
      rpc: async (contract: { name: string }) => contract.name === "settings.read"
        ? { ok: false, reason: "missing", path: "/settings" } : { branch: null, memory: null, outputStyle: null },
      addComposerPill: add,
    } as unknown as PluginClientContext);
    try {
      await Promise.resolve();
      observer.snapshot({ entries: [{ agent: agent("old") }] });
      await vi.advanceTimersByTimeAsync(1000);
      const icon = add.mock.calls[0][0].button.icon;
      observer.snapshot({ entries: [{ agent: agent("new") }] });
      expect(registrations[0].remove).toHaveBeenCalledTimes(1);
      expect(add.mock.calls[1][0].button.icon).toBe(icon);
      observer.update({ type: "agent_update", payload: { kind: "upsert", agent: { ...agent("new"),
        lastUsage: { contextWindowUsedTokens: 101, contextWindowMaxTokens: 1000 } } } });
      await vi.advanceTimersByTimeAsync(1000);
      registrations[1].update.mockClear();
      observer.update({ type: "agent_update", payload: { kind: "upsert", agent: { ...agent("new"),
        lastUsage: { contextWindowUsedTokens: 102, contextWindowMaxTokens: 1000 } } } });
      await vi.advanceTimersByTimeAsync(1000);
      expect(registrations[1].update).not.toHaveBeenCalled();
      observer.update({ type: "agent_update", payload: { kind: "remove", agentId: "new" } });
      await vi.advanceTimersByTimeAsync(1000);
      observer.update({ type: "agent_update", payload: { kind: "upsert", agent: agent("new") } });
      expect(vi.getTimerCount()).toBe(0);
      expect(add).toHaveBeenCalledTimes(2);
      expect(list.mock.calls[0][0].subscribe).toEqual({});
    } finally {
      stop();
      expect(list.mock.calls[0][0].signal.aborted).toBe(true);
      expect(unsubscribe).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      vi.useRealTimers();
    }
  });
});
