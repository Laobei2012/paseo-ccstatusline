import type { PluginButtonIconProps } from "@getpaseo/plugin/client";
import { useSyncExternalStore } from "react";
import { View } from "react-native";
import type { StatusStore } from "./store";

// Create once per plugin lifetime, so updates never replace the icon component.
export function createContextIcon(store: StatusStore) {
  return function ContextIcon(props: PluginButtonIconProps) {
    const agentId = props.context === "agent" ? props.agentId : "";
    const percent = useSyncExternalStore(store.subscribe, () => store.getView(agentId)?.contextPercent ?? null);
    const { size, color } = props;
    return <View style={{ width: size, height: size, justifyContent: "center" }}>
      <View style={{ width: size, height: size * 0.45, borderWidth: 1, borderColor: color, borderRadius: 2, overflow: "hidden" }}>
        <View style={{ width: `${percent ?? 0}%`, height: "100%", backgroundColor: color }} />
      </View>
    </View>;
  };
}
