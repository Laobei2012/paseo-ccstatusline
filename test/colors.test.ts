import { describe, expect, it } from "vitest";
import fixture from "./fixtures/settings.json";
import { parseSettings } from "../shared/settings";
import { themeColors } from "../shared/themes";
import { toHex } from "../shared/colors";

describe("status colors", () => {
  it.each([["red", "#d70000"], ["cyan", "#008787"]])("uses the source ANSI256 mapping for named %s at level 2", (color, expected) => {
    expect(toHex(color, 2)).toBe(expected);
  });
  it.each([
    ["ansi256:131", "#af5f5f"], ["ansi256:220", "#ffd700"],
    ["ansi256:68", "#5f87d7"], ["ansi256:108", "#87af87"],
    ["ansi256:176", "#d787d7"], ["ansi256:231", "#ffffff"],
    ["ansi256:16", "#000000"], ["ansi256:232", "#080808"],
    ["ansi256:255", "#eeeeee"], ["hex:BF616A", "#bf616a"],
    ["red", "#cc0000"], ["bgCyan", "#06989a"],
    ["brightWhite", "#eeeeec"], ["bgBrightWhite", "#eeeeec"],
  ])("converts %s to %s", (value, expected) => {
    expect(toHex(value)).toBe(expected);
  });

  it.each(["", "unknown", "ansi256:-1", "ansi256:256", "ansi256:1.5", "ansi256:2x", "hex:gggggg", "hex:12345"])("rejects invalid colors: %s", (value) => {
    expect(toHex(value)).toBeNull();
  });

  it("matches the five source theme slots and repeats", () => {
    const settings = parseSettings(fixture);
    expect([0, 1, 2, 3, 4, 5].map((slot) => themeColors(settings, slot))).toEqual([
      { fg: "#ffffff", bg: "#af5f5f" }, { fg: "#000000", bg: "#ffd700" },
      { fg: "#ffffff", bg: "#5f87d7" }, { fg: "#000000", bg: "#87af87" },
      { fg: "#000000", bg: "#d787d7" }, { fg: "#ffffff", bg: "#af5f5f" },
    ]);
  });

  it("selects the truecolor variant", () => {
    expect(themeColors(parseSettings({ ...fixture, colorLevel: 3 }), 0)).toEqual({ fg: "#eceff4", bg: "#bf616a" });
  });

  it("selects the named ANSI16 variant", () => {
    expect(themeColors(parseSettings({ ...fixture, colorLevel: 1 }), 0)).toEqual({ fg: "#eeeeec", bg: "#cc0000" });
  });

  it("copies other built-in palettes from ccstatusline", () => {
    const settings = parseSettings({ ...fixture, colorLevel: 3, powerline: { ...fixture.powerline, theme: "tokyonight" } });
    expect(themeColors(settings, 0)).toEqual({ fg: "#1a1b26", bg: "#7aa2f7" });
  });
});
