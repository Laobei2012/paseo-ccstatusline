import { Platform, Text, View, type TextStyle, type ViewStyle } from "react-native";
import type { Segment } from "../shared/widgets";

export function segmentRowStyle(): ViewStyle {
  return { flexDirection: "row", flexWrap: "wrap", maxWidth: "100%", alignItems: "flex-start", rowGap: 4, paddingRight: 6 };
}

export function segmentOuterStyle(): ViewStyle {
  return { maxWidth: "100%", flexShrink: 1, flexDirection: "row", alignItems: "center" };
}

export function SegmentRow({ segments, foreground, powerline, bold }: {
  segments: Segment[]; foreground: string; powerline: boolean; bold: boolean;
}) {
  const wrappingText: TextStyle & { overflowWrap?: "anywhere" } = {
    minWidth: 0, ...(Platform.OS === "web" ? { overflowWrap: "anywhere" as const } : {}),
  };
  return <View style={segmentRowStyle()}>{segments.map((segment, index) =>
    <View key={index} style={{ ...segmentOuterStyle(), backgroundColor: segment.bg ?? "transparent", marginRight: powerline ? 8 : 0 }}>
      <Text style={{ ...wrappingText, color: segment.fg || foreground, fontFamily: "monospace", fontSize: 12, lineHeight: 18,
        fontStyle: segment.estimate ? "italic" : "normal", fontWeight: bold ? "bold" : "normal",
        flexShrink: 1, paddingHorizontal: powerline ? 6 : 0 }}>
        {segment.text}
      </Text>
      {powerline ? <View accessibilityElementsHidden style={{ position: "absolute", right: -6, top: 0, width: 0, height: 0,
        borderTopWidth: 9, borderBottomWidth: 9, borderLeftWidth: 6,
        borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: segment.bg ?? "transparent" }} />
        : index < segments.length - 1 ? <Text style={{ color: foreground, fontFamily: "monospace", fontSize: 12, lineHeight: 18 }}> | </Text> : null}
    </View>
  )}</View>;
}
