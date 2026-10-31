import { describe, expect, it } from "vitest";
import { reconcilePills, type PillRecord } from "../client/pills";
import type { AgentRecord } from "../client/store";

const agent = (id: string, workspaceId = "workspace"): AgentRecord => ({
  id, workspaceId, cwd: "/repo", provider: "claude", model: null, status: "idle",
});
const record = (workspaceId = "workspace"): PillRecord => ({
  workspaceId, registration: { update() {}, remove() {} }, label: "-- · -- · --", title: "Status", contextPercent: null,
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
});
