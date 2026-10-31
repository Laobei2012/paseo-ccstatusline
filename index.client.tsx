import type { PluginButtonContentProps, PluginClientContext } from "@getpaseo/plugin/client";
import { useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import { createContextIcon } from "./client/context-icon";
import { reconcilePills, type PillRecord } from "./client/pills";
import { createStatusStore, type AgentRecord } from "./client/store";
import { factsReadRpc, settingsReadRpc } from "./shared/rpc";

export default function contribute(client: PluginClientContext) {
  const lifetime = new AbortController();
  const store = createStatusStore({
    readSettings: () => client.rpc(settingsReadRpc, {}),
    readFacts: (input) => client.rpc(factsReadRpc, input),
    listUsage: () => client.paseo.providers.listUsage(),
    listModels: (provider) => client.paseo.providers.listModels(provider),
    now: () => Date.now(),
  });
  const Icon = createContextIcon(store);
  const pills = new Map<string, PillRecord>();
  const agents = new Map<string, AgentRecord>();
  const removedAgents = new Set<string>();

  // Task 6 replaces this plain content with the styled popover and skill reader.
  function StatusContent(props: PluginButtonContentProps) {
    const id = props.context === "agent" ? props.agentId : "";
    const view = useSyncExternalStore(store.subscribe, () => store.getView(id));
    return <View style={{ padding: 12 }}><Text style={{ color: props.theme.colors.foreground }}>
      {view?.settingsError ?? view?.title ?? "Loading status…"}
    </Text></View>;
  }

  function syncPills() {
    if (lifetime.signal.aborted) return;
    const change = reconcilePills(pills, [...agents.values()]);
    for (const id of change.remove) { pills.get(id)?.registration.remove(); pills.delete(id); }
    for (const agent of change.add) {
      const view = store.getView(agent.id);
      const label = view?.label ?? "-- · -- · --";
      const title = view?.title || view?.settingsError || "Loading status…";
      const registration = client.addComposerPill({
        id: "status", workspaceId: agent.workspaceId!, agentId: agent.id,
        button: { label, title, icon: Icon, behavior: { kind: "popover", Content: StatusContent } },
      });
      pills.set(agent.id, { workspaceId: agent.workspaceId!, registration, label, title, contextPercent: view?.contextPercent ?? null });
    }
    for (const [id, pill] of pills) {
      const view = store.getView(id);
      if (!view) continue;
      const title = view.title || view.settingsError || "Status unavailable";
      if (pill.label === view.label && pill.title === title) continue;
      pill.registration.update({ label: view.label, title });
      pill.label = view.label; pill.title = title; pill.contextPercent = view.contextPercent;
    }
  }
  const unsubscribeStore = store.subscribe(syncPills);
  let unsubscribeAgents: (() => void) | undefined;
  void client.paseo.agents.list({ subscribe: {}, signal: lifetime.signal }).then(({ subscription }) => {
    if (lifetime.signal.aborted) return;
    unsubscribeAgents = subscription.subscribe({
      snapshot: ({ entries }) => {
        if (lifetime.signal.aborted) return;
        agents.clear();
        removedAgents.clear();
        for (const { agent } of entries) agents.set(agent.id, agent);
        store.setAgents([...agents.values()]);
        syncPills();
      },
      update: (message) => {
        if (lifetime.signal.aborted || message.type !== "agent_update") return;
        const update = message.payload;
        if (update.kind === "remove") {
          removedAgents.add(update.agentId);
          agents.delete(update.agentId); store.removeAgent(update.agentId);
        } else {
          if (removedAgents.has(update.agent.id)) return;
          const existing = store.getView(update.agent.id) !== null;
          agents.set(update.agent.id, update.agent);
          if (existing) store.upsertAgent(update.agent);
          else store.setAgents([...agents.values()]);
        }
        // Remove registrations immediately; presentation updates come from the store's throttle.
        const { remove } = reconcilePills(pills, [...agents.values()]);
        for (const id of remove) { pills.get(id)?.registration.remove(); pills.delete(id); }
      },
      error: () => { if (!lifetime.signal.aborted) console.error("ccstatusline agent subscription failed"); },
    });
  }).catch(() => { if (!lifetime.signal.aborted) console.error("ccstatusline agent subscription failed"); });

  return () => {
    lifetime.abort(); unsubscribeAgents?.(); unsubscribeStore(); store.stop();
    for (const pill of pills.values()) pill.registration.remove();
    pills.clear(); agents.clear(); removedAgents.clear();
  };
}
