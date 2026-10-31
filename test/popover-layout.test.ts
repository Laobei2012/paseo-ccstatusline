import { Children, isValidElement, type ReactNode } from "react";
import type { PluginButtonContentProps } from "@getpaseo/plugin/client";
import { expect, it, vi } from "vitest";
import { createStatusPopover } from "../client/popover";
import { SegmentRow } from "../client/segment-row";
import type { StatusStore } from "../client/store";

vi.mock("react-native", () => ({ Text: "Text", View: "View" }));
vi.mock("@getpaseo/plugin/client/ui", () => ({ ScrollView: "ScrollView" }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: () => {},
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

it("puts every status row in one horizontal scroller and keeps explanatory text outside it", () => {
  const lines = [
    [{ text: "Model", estimate: false }],
    [],
    [{ text: "cwd: /" + "long-path/".repeat(100), estimate: false }],
  ];
  const store = { subscribe: vi.fn(), getView: () => ({
    agentTitle: "Test agent", usageAccount: "Test account", settingsError: "Settings error",
    hiddenTypes: ["skills"], lines, powerline: true, globalBold: false,
  }) } as unknown as StatusStore;
  const Popover = createStatusPopover(store);
  const tree = Popover({ context: "agent", agentId: "agent", workspaceId: "workspace",
    theme: { colors: { foreground: "#fff", foregroundMuted: "#aaa", statusDanger: "#f00" } },
  } as unknown as PluginButtonContentProps);
  const scrollers: object[] = [];
  const rows: { segments: unknown; scrollers: object[] }[] = [];
  const explanations: { text: string; scrollers: object[] }[] = [];
  function visit(node: ReactNode, ancestors: object[] = []) {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode; horizontal?: boolean; segments?: unknown }>(child)) return;
      let next = ancestors;
      if (child.type === "ScrollView") {
        expect(child.props.horizontal).toBe(true);
        scrollers.push(child);
        next = [...ancestors, child];
      }
      if (child.type === SegmentRow) rows.push({ segments: child.props.segments, scrollers: next });
      if (child.type === "Text") explanations.push({
        text: Children.toArray(child.props.children).join(""), scrollers: next,
      });
      visit(child.props.children, next);
    });
  }
  visit(tree);
  expect(scrollers).toHaveLength(1);
  expect(rows.map((row) => row.segments)).toEqual([lines[0], lines[2]]);
  for (const row of rows) expect(row.scrollers).toEqual(scrollers);
  expect(explanations.map((item) => item.text)).toEqual([
    "Test agent", "Usage: Test account", "Settings error", "Hidden widgets: skills",
  ]);
  for (const explanation of explanations) expect(explanation.scrollers).toEqual([]);
});
