import type { PluginButtonContentProps, PluginButtonRegistration, PluginClientContext } from "@getpaseo/plugin/client";
import { Text, View } from "react-native";

const rows = [
  "Model: Opus 5.5 > Context: [████████████░░░░] 147k/200k (74%) > ⎇ main",
  "cwd: /Volumes/WDSN580/src/paseo-work/paseo > Mem: 7.1G/16.0G",
  "Cached: 2.8M > In: 52 > Out: 22.7k > In: 0.2 t/s > Out: 100.4 t/s > Total: 100.6 t/s",
  "Reset: 2hr 27m > 5h: 63.0% > Weekly Reset: 4d 20hr 7m > Weekly: 39.0%",
  "Thinking: high > Skill: superpowers:brainstorming > Style: simple-english"
];

function ProbeContent({ theme }: PluginButtonContentProps) {
  return <View style={{ padding: 12 }}><Text style={{ color: theme.colors.foregroundMuted }}>Tooltip probe: fixed example values</Text></View>;
}

export default function contribute(client: PluginClientContext) {
  const pills = new Map<string, PluginButtonRegistration>();
  const lifetime = new AbortController();
  const removeAll = () => { for (const pill of pills.values()) pill.remove(); pills.clear(); };
  const register = (agent: { id: string; workspaceId?: string | null; archivedAt?: string | null }) => {
    pills.get(agent.id)?.remove();
    pills.delete(agent.id);
    if (lifetime.signal.aborted || !agent.workspaceId || agent.archivedAt) return;
    pills.set(agent.id, client.addComposerPill({
      id: "tooltip-probe", workspaceId: agent.workspaceId, agentId: agent.id,
      button: { title: rows.join("\n"), icon: "Gauge", label: "74% · 63% · 39%", behavior: { kind: "popover", Content: ProbeContent } },
    }));
  };
  void client.paseo.agents.list({ subscribe: {}, signal: lifetime.signal }).then(({ subscription }) => {
    subscription.subscribe({
      snapshot: ({ entries }) => { removeAll(); for (const { agent } of entries) register(agent); },
      update: (message) => {
        if (message.type !== "agent_update") return;
        const update = message.payload;
        if (update.kind === "upsert") register(update.agent);
        else { pills.get(update.agentId)?.remove(); pills.delete(update.agentId); }
      },
    });
  }).catch(() => { if (!lifetime.signal.aborted) console.error("Tooltip probe agent subscription failed"); });
  return () => { lifetime.abort(); removeAll(); };
}
