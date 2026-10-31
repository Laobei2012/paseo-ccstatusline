import type { PluginButtonRegistration } from "@getpaseo/plugin/client";
import type { AgentRecord } from "./store";

export type PillRecord = {
  workspaceId: string; registration: PluginButtonRegistration;
  label: string; title: string;
};

export function reconcilePills(previous: Map<string, PillRecord>, next: AgentRecord[]): { add: AgentRecord[]; remove: string[] } {
  const eligible = new Map(next.filter((agent) => agent.workspaceId && !agent.archivedAt).map((agent) => [agent.id, agent]));
  const remove = [...previous].filter(([id, pill]) => eligible.get(id)?.workspaceId !== pill.workspaceId).map(([id]) => id);
  const add = [...eligible.values()].filter((agent) => previous.get(agent.id)?.workspaceId !== agent.workspaceId);
  return { add, remove };
}
