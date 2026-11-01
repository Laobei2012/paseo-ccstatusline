import type { PluginButtonContentProps } from "@getpaseo/plugin/client";
import { ScrollView } from "@getpaseo/plugin/client/ui";
import { useEffect, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import { SegmentRow } from "./segment-row";
import type { StatusStore } from "./store";
import { createViewModeStore } from "./view-mode";

const viewModes = ["text", "colored"] as const;

export function createStatusPopover(store: StatusStore, modes = createViewModeStore()) {
  return function StatusPopover(props: PluginButtonContentProps) {
    const agentId = props.context === "agent" ? props.agentId : "";
    const view = useSyncExternalStore(store.subscribe, () => store.getView(agentId));
    const mode = useSyncExternalStore(modes.subscribe, modes.getSnapshot);
    useEffect(() => store.openPopover(agentId), [agentId]);
    const colors = props.theme.colors;
    return <View style={{ maxWidth: "100%", flexShrink: 1, gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
        {view?.agentTitle || "Agent status"}
      </Text>
      {view?.usageAccount ? <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>Usage: {view.usageAccount}</Text> : null}
      <View accessibilityRole="toolbar" accessibilityLabel="Status view" style={{ flexDirection: "row", gap: 4 }}>
        {viewModes.map((value) => <Pressable key={value}
          accessibilityRole="button" accessibilityLabel={value === "text" ? "Text view" : "Colored view"}
          aria-selected={mode === value}
          accessibilityState={{ selected: mode === value }} onPress={() => modes.setMode(value)}
          style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6,
            backgroundColor: mode === value ? colors.surface2 : "transparent" }}>
          <Text style={{ color: mode === value ? colors.foreground : colors.foregroundMuted, fontSize: 12 }}>
            {value === "text" ? "Text" : "Colored"}
          </Text>
        </Pressable>)}
      </View>
      {view?.settingsError ? <Text style={{ color: colors.statusDanger, fontSize: 12 }}>{view.settingsError}</Text> : null}
      <ScrollView testID="ccstatusline-rows" horizontal style={{ maxWidth: "100%" }}>
        <View style={{ gap: 6, alignItems: "flex-start" }}>
          {view?.lines.map((segments, index) => {
            if (!segments.length) return null;
            if (mode === "colored") return <SegmentRow key={index} segments={segments}
              foreground={colors.foreground} powerline={view.powerline} bold={view.globalBold} />;
            return <Text key={index} numberOfLines={1} style={{ color: colors.foreground, fontFamily: "monospace", fontSize: 12, lineHeight: 18 }}>
              {segments.map((segment) => segment.text).join(" | ")}
            </Text>;
          })}
        </View>
      </ScrollView>
      {view?.hiddenTypes.length ? <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>
        Hidden widgets: {view.hiddenTypes.join(", ")}
      </Text> : null}
      {!view ? <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>Status unavailable</Text> : null}
    </View>;
  };
}
