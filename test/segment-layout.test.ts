import { expect, it, vi } from "vitest";
import { segmentRowStyle, segmentOuterStyle, SegmentRow } from "../client/segment-row";
import type { Segment } from "../shared/widgets";

vi.mock("react-native", () => ({ Text: "Text", View: "View", Platform: { OS: "web" } }));

it("wraps rows and constrains each segment inside the popover", () => {
  expect(segmentRowStyle()).toMatchObject({ flexDirection: "row", flexWrap: "wrap", maxWidth: "100%", paddingRight: 6 });
  expect(segmentOuterStyle()).toMatchObject({ maxWidth: "100%", flexShrink: 1 });
});

it("renders null backgrounds as transparent and estimates as italic monospace", () => {
  const segment: Segment = { text: "Estimated output ".repeat(50), fg: "#123456", bg: null, estimate: true };
  const row = SegmentRow({ segments: [segment], foreground: "#abcdef", powerline: false, bold: false });
  const outer = row.props.children[0];
  expect(outer.props.style).toMatchObject({ backgroundColor: "transparent", maxWidth: "100%" });
  expect(outer.props.children[0].props.style).toMatchObject({ color: "#123456", fontFamily: "monospace", fontStyle: "italic", flexShrink: 1,
    minWidth: 0, overflowWrap: "anywhere" });
});

it("draws a Powerline separator as a View shape and preserves configured colors", () => {
  const row = SegmentRow({ segments: [{ text: "Model", fg: "#ffffff", bg: "#af5f5f", estimate: false }],
    foreground: "#000000", powerline: true, bold: true });
  const outer = row.props.children[0];
  expect(outer.props.style.backgroundColor).toBe("#af5f5f");
  expect(outer.props.children[0].props.style.fontWeight).toBe("bold");
  expect(outer.props.children[1].type).toBe("View");
});
