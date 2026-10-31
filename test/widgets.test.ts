import { describe, expect, it } from "vitest";
import fixture from "./fixtures/settings.json";
import { all, nothing, now } from "./fixtures/facts";
import { parseSettings } from "../shared/settings";
import { buildLines, plainText, hoverText } from "../shared/widgets";

const expected = [
  ["model", "Model: Opus 5.5"],
  ["context-bar", "Context: [████████████░░░░] 147k/200k (74%)"],
  ["git-branch", "⎇ main"],
  ["current-working-dir", "cwd: /Volumes/WDSN580/src/paseo-work/paseo"],
  ["free-memory", "Mem: 7.1G/16.0G"],
  ["tokens-cached", "Cached: 2.8M"], ["tokens-input", "In: 52"], ["tokens-output", "Out: 22.7k"],
  ["input-speed", "In: 0.2 t/s"], ["output-speed", "Out: 100.4 t/s"], ["total-speed", "Total: 100.6 t/s"],
  ["reset-timer", "Reset: 2hr 27m"], ["session-usage", "5h: 63.0%"],
  ["weekly-reset-timer", "Weekly Reset: 4d 20hr 7m"], ["weekly-usage", "Weekly: 39.0%"],
  ["thinking-effort", "Thinking: high"], ["skills", "Skill: superpowers:brainstorming"], ["output-style", "Style: simple-english"],
];

// ccstatusline 2.2.33 getDefaultColor() values, converted at colorLevel 3.
const defaultColors = [
  ["model", "#06989a"], ["context-bar", "#3465a4"],
  ["git-branch", "#75507b"], ["current-working-dir", "#3465a4"],
  ["free-memory", "#06989a"], ["tokens-cached", "#06989a"],
  ["tokens-input", "#3465a4"], ["tokens-output", "#d3d7cf"],
  ["input-speed", "#06989a"], ["output-speed", "#06989a"], ["total-speed", "#06989a"],
  ["reset-timer", "#729fcf"], ["session-usage", "#729fcf"],
  ["weekly-reset-timer", "#729fcf"], ["weekly-usage", "#729fcf"],
  ["thinking-effort", "#75507b"], ["skills", "#75507b"], ["output-style", "#06989a"],
];

describe("widget text and segments", () => {
  it.each(defaultColors)("uses the default color and no background for %s", (type, fg) => {
    for (const enabled of [false, true]) {
      const settings = parseSettings({ lines: [[{ type }]], colorLevel: 3, powerline: { enabled } });
      expect(buildLines(settings, all, now).lines[0][0]).toMatchObject({ fg, bg: null });
    }
  });

  it("keeps an explicit foreground without inventing a background", () => {
    const settings = parseSettings({ lines: [[{ type: "model", color: "red" }]], colorLevel: 3 });
    expect(buildLines(settings, all, now).lines[0][0]).toMatchObject({ fg: "#cc0000", bg: null });
  });

  it("combines a default foreground with an explicit background at level 2", () => {
    const settings = parseSettings({ lines: [[{ type: "free-memory", backgroundColor: "bgRed" }]], colorLevel: 2 });
    expect(buildLines(settings, all, now).lines[0][0]).toMatchObject({ fg: "#008787", bg: "#d70000" });
  });

  it("hides negative context counts while keeping other widgets", () => {
    const settings = parseSettings({ lines: [[{ type: "context-bar" }, { type: "model" }]] });
    expect(buildLines(settings, { ...all, contextUsed: -5 }, now).lines[0].map((segment) => segment.text))
      .toEqual(["Model: Opus 5.5"]);
  });

  it.each(expected)("formats %s", (type, text) => {
    const { lines } = buildLines(parseSettings({ lines: [[{ type }]] }), all, now);
    expect(lines[0][0].text).toBe(text);
    expect(lines[0][0].estimate).toBe(type.endsWith("-speed"));
  });

  it("renders the configured example rows and account hover row", () => {
    const { lines, hiddenTypes } = buildLines(parseSettings(fixture), all, now);
    expect(plainText(lines).split("\n")[0]).toBe("Model: Opus 5.5 | Context: [████████████░░░░] 147k/200k (74%) | ⎇ main");
    expect(lines[3].map((segment) => segment.text)).toEqual(["Reset: 2hr 27m", "5h: 63.0%", "Weekly Reset: 4d 20hr 7m", "Weekly: 39.0%"]);
    expect(hoverText(lines, all.usageAccount)).toBe(`Usage: Claude (example account)\n${plainText(lines)}`);
    expect(hoverText(lines, null)).toBe(plainText(lines));
    expect(hiddenTypes).toEqual([]);
  });

  it("hides every missing supported value without reporting it as unsupported", () => {
    const result = buildLines(parseSettings(fixture), nothing, now);
    expect(result.lines).toEqual([[], [], [], [], []]);
    expect(result.hiddenTypes).toEqual([]);
    expect(plainText(result.lines)).toBe("");
  });

  it("reports unknown types once and keeps their neighbors", () => {
    const result = buildLines(parseSettings({ lines: [[{ type: "future" }, { type: "model" }, { type: "future" }]] }), all, now);
    expect(result.hiddenTypes).toEqual(["future"]);
    expect(result.lines[0].map((segment) => segment.text)).toEqual(["Model: Opus 5.5"]);
  });

  it("resets theme slots per row and skips hidden widgets", () => {
    const settings = parseSettings({ ...fixture, lines: [[{ type: "git-branch" }, { type: "model" }, { type: "skills" }], [{ type: "thinking-effort" }]] });
    const { lines } = buildLines(settings, { ...all, branch: null }, now);
    expect(lines[0].map(({ fg, bg }) => ({ fg, bg }))).toEqual([{ fg: "#ffffff", bg: "#af5f5f" }, { fg: "#000000", bg: "#ffd700" }]);
    expect(lines[1][0].bg).toBe("#af5f5f");
    settings.powerline.continueThemeAcrossLines = true;
    expect(buildLines(settings, { ...all, branch: null }, now).lines[1][0].bg).toBe("#5f87d7");
  });

  it.each([false, true])("uses widget colors with no theme, Powerline enabled=%s", (enabled) => {
    const settings = parseSettings({ lines: [[{ type: "model", color: "red", backgroundColor: "bgCyan" }]], powerline: { enabled }, colorLevel: 2 });
    expect(buildLines(settings, all, now).lines[0][0]).toMatchObject({ fg: "#d70000", bg: "#008787" });
  });

  it("ignores a selected theme when Powerline is off", () => {
    const settings = parseSettings({ ...fixture, powerline: { ...fixture.powerline, enabled: false } });
    expect(buildLines(settings, all, now).lines[0][0].fg).toBe("#008787");
  });

  it("clamps context bars and hides invalid numeric values", () => {
    const settings = parseSettings({ lines: [[{ type: "context-bar" }, { type: "tokens-input" }, { type: "output-speed" }]] });
    const { lines } = buildLines(settings, { ...all, contextUsed: 300000, tokens: { ...all.tokens, input: NaN }, speed: { ...all.speed, output: Infinity } }, now);
    expect(lines[0].map((segment) => segment.text)).toEqual(["Context: [████████████████] 300k/200k (100%)"]);
    expect(buildLines(settings, { ...nothing, contextUsed: 1, contextMax: 0 }, now).lines[0]).toEqual([]);
  });

  it("formats small and large token, speed and memory magnitudes", () => {
    const settings = parseSettings({ lines: [[{ type: "tokens-input" }, { type: "output-speed" }, { type: "free-memory" }]] });
    expect(buildLines(settings, { ...all, tokens: { ...all.tokens, input: 1000 }, speed: { ...all.speed, output: 1000 }, memory: { used: 512, total: 1024 ** 2 } }, now).lines[0].map((segment) => segment.text)).toEqual(["In: 1.0k", "Out: 1.0k t/s", "Mem: 512B/1M"]);
  });

  it("hides invalid reset dates and clamps elapsed reset durations to zero", () => {
    const settings = parseSettings({ lines: [[{ type: "reset-timer" }, { type: "weekly-reset-timer" }]] });
    expect(buildLines(settings, { ...all, session: { usedPct: 0, resetsAt: "invalid" }, weekly: { usedPct: 0, resetsAt: "2020-01-01T00:00:00Z" } }, now).lines[0].map((segment) => segment.text)).toEqual(["Weekly Reset: 0m"]);
  });
});
