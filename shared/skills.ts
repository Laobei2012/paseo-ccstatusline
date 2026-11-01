import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";

export type TimelineItem = AgentTimelineItem;

// Recent pages are ordered from oldest to newest.
export function lastSkill(items: TimelineItem[], provider: string): string | null {
  if (provider !== "claude") return null;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type !== "tool_call" || item.name !== "Skill" || item.detail.type !== "plain_text" || item.error != null) continue;
    if (typeof item.detail.label === "string" && item.detail.label.trim()) return item.detail.label;
  }
  return null;
}
