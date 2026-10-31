import type { PluginButtonContentProps } from "@getpaseo/plugin/client";
import { useEffect, useSyncExternalStore } from "react";
import { ScrollView, Text, View } from "react-native";
import { SegmentRow } from "./segment-row";
import type { StatusStore } from "./store";

export function createStatusPopover(store: StatusStore) {
  return function StatusPopover(props: PluginButtonContentProps) {
    const agentId = props.context === "agent" ? props.agentId : "";
    const view = useSyncExternalStore(store.subscribe, () => store.getView(agentId));
    useEffect(() => store.openPopover(agentId), [agentId]);
    const colors = props.theme.colors;
    return <View style={{ maxWidth: "100%", flexShrink: 1, padding: props.layout.compact ? 12 : 16, gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
        {view?.agentTitle || "Agent status"}
      </Text>
      {view?.usageAccount ? <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>Usage: {view.usageAccount}</Text> : null}
      <ScrollView style={{ maxWidth: "100%", maxHeight: 420, flexShrink: 1 }} contentContainerStyle={{ gap: 6 }}>
        {view?.settingsError ? <Text style={{ color: colors.statusDanger, fontSize: 12 }}>{view.settingsError}</Text> : null}
        {view?.lines.map((segments, index) => segments.length ? <SegmentRow key={index} segments={segments}
          foreground={colors.foreground} powerline={view.powerline} bold={view.globalBold} /> : null)}
        {view?.hiddenTypes.length ? <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>
          Hidden widgets: {view.hiddenTypes.join(", ")}
        </Text> : null}
        {!view ? <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>Status unavailable</Text> : null}
      </ScrollView>
    </View>;
  };
}
