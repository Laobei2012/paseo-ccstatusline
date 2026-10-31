import { describe, expect, it } from "vitest";
import { lastSkill, type TimelineItem } from "../shared/skills";

const skill = (label: string): TimelineItem => ({
  type: "tool_call", callId: label, name: "Skill",
  detail: { type: "plain_text", label, icon: "sparkles", text: `Launching skill: ${label}` },
  status: "completed", error: null,
});
const codex: TimelineItem[] = [{
  type: "tool_call", callId: "shell", name: "shell", status: "completed", error: null,
  detail: { type: "shell", command: "cat SKILL.md", cwd: "/repo" },
}];

describe("last used skill", () => {
  it("returns the newest explicit Claude skill in chronological timeline order", () => {
    expect(lastSkill([skill("paseo"), ...codex, skill("superpowers:writing-plans")], "claude")).toBe("superpowers:writing-plans");
    expect(lastSkill([], "claude")).toBeNull();
  });
  it("hides skills for Codex and other providers, even with a Claude-shaped item", () => {
    expect(lastSkill(codex, "codex")).toBeNull();
    expect(lastSkill([skill("paseo")], "codex")).toBeNull();
    expect(lastSkill([skill("paseo")], "copilot")).toBeNull();
  });
  it("requires tool_call, exact Skill name and a nonempty plain_text label", () => {
    const valid = skill("paseo");
    const invalid = [
      { ...valid, type: "assistant_message" },
      { ...valid, name: "skill" },
      { ...valid, detail: { type: "shell", label: "fake", command: "Skill" } },
      { ...valid, detail: { type: "plain_text", text: "Launching skill: fake" } },
      { ...valid, detail: { type: "plain_text", label: "   " } },
    ] as TimelineItem[];
    expect(lastSkill(invalid, "claude")).toBeNull();
    expect(lastSkill([valid, ...invalid], "claude")).toBe("paseo");
  });
});
