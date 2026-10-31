import { expect, it } from "vitest";
import { all, nothing } from "./fixtures/facts";
import { contextPercent, pillLabel } from "../shared/summary";

it("keeps context, five-hour and weekly positions fixed", () => {
  expect(pillLabel(all)).toBe("74% · 63% · 39%");
  expect(pillLabel({ ...all, session: null, weekly: null })).toBe("74% · -- · --");
  expect(pillLabel(nothing)).toBe("-- · -- · --");
  expect(pillLabel({ ...nothing, weekly: { usedPct: 39.6, resetsAt: null } })).toBe("-- · -- · 40%");
});

it("clamps context usage while rejecting missing and invalid denominators", () => {
  expect(contextPercent({ ...all, contextUsed: 300, contextMax: 200 })).toBe(100);
  expect(contextPercent({ ...all, contextMax: 0 })).toBeNull();
  expect(contextPercent({ ...all, contextUsed: null })).toBeNull();
  expect(contextPercent({ ...all, contextUsed: Infinity })).toBeNull();
  expect(contextPercent({ ...all, contextUsed: -1 })).toBe(0);
});

it("keeps valid zero measurements visible", () => {
  expect(pillLabel({ ...all, contextUsed: 0, session: { usedPct: 0, resetsAt: null }, weekly: { usedPct: NaN, resetsAt: null } })).toBe("0% · 0% · --");
});
