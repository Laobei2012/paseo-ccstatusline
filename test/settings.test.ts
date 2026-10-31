import { mkdtemp, rm, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/settings.json";
import { parseSettings, SettingsError } from "../shared/settings";
import { readSettings } from "../server/settings";

describe("settings parsing", () => {
  it("preserves the real layout and drops fields outside the RPC contract", () => {
    const settings = parseSettings(fixture);
    expect(settings.lines.map((line) => line.length)).toEqual([3, 2, 6, 4, 3]);
    expect(settings.lines[0][0]).toEqual({ id: "1", type: "model", color: "cyan" });
    expect(settings.powerline).toEqual({ enabled: true, theme: "nord-aurora", continueThemeAcrossLines: false });
    expect(settings).not.toHaveProperty("flexMode");
    expect(settings.powerline).not.toHaveProperty("separators");
  });

  it.each([null, {}, { lines: "x" }, { lines: [null] }, { lines: [], colorLevel: 9 }])("rejects invalid configuration: %j", (raw) => {
    expect(() => parseSettings(raw)).toThrow(SettingsError);
  });

  it("accepts an empty layout and supplies defaults", () => {
    expect(parseSettings({ lines: [] })).toEqual({
      lines: [], colorLevel: 2, globalBold: false,
      powerline: { enabled: false, continueThemeAcrossLines: false },
    });
  });

  it("drops malformed widgets while preserving neighbors and unknown types", () => {
    const settings = parseSettings({ lines: [[
      { id: "a", type: "model", merge: true }, null, {}, { type: 9 },
      { id: "b", type: "future-widget", rawValue: true },
    ]] });
    expect(settings.lines[0]).toEqual([
      { id: "a", type: "model" }, { id: "b", type: "future-widget", rawValue: true },
    ]);
  });

  it("keeps an omitted Powerline theme absent so widget colors can apply", () => {
    expect(parseSettings({ lines: [[{ type: "model", color: "red" }]], powerline: { enabled: true } }).powerline).not.toHaveProperty("theme");
  });
});

describe("daemon settings reader", () => {
  let directory: string | undefined;
  afterEach(async () => {
    vi.unstubAllEnvs();
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  async function settingsPath() {
    directory = await mkdtemp(join(tmpdir(), "ccstatusline-settings-"));
    const path = join(directory, "settings.json");
    vi.stubEnv("CCSTATUSLINE_SETTINGS_PATH", path);
    return path;
  }

  it("returns the selected path and parsed settings", async () => {
    const path = await settingsPath();
    await writeFile(path, JSON.stringify(fixture));
    expect(await readSettings()).toEqual({ ok: true, path, settings: parseSettings(fixture) });
  });

  it("returns a reason for a missing file", async () => {
    const path = await settingsPath();
    expect(await readSettings()).toMatchObject({ ok: false, path, reason: expect.any(String) });
  });

  it.each(["{invalid private content", JSON.stringify({ lines: "private content" })])("reports invalid files without exposing their contents", async (contents) => {
    const path = await settingsPath();
    await writeFile(path, contents);
    const result = await readSettings();
    expect(result).toMatchObject({ ok: false, path, reason: expect.any(String) });
    expect(JSON.stringify(result)).not.toContain("private content");
  });

  it("reloads a saved change after a successful read", async () => {
    const path = await settingsPath();
    await writeFile(path, JSON.stringify(fixture));
    expect((await readSettings()).ok).toBe(true);
    await writeFile(path, JSON.stringify({ lines: [], globalBold: true }));
    await utimes(path, new Date(), new Date(Date.now() + 2000));
    expect(await readSettings()).toMatchObject({ ok: true, settings: { lines: [], globalBold: true } });
  });

  it("recovers after an invalid file is repaired", async () => {
    const path = await settingsPath();
    await writeFile(path, "{");
    expect((await readSettings()).ok).toBe(false);
    await writeFile(path, JSON.stringify(fixture));
    await utimes(path, new Date(), new Date(Date.now() + 2000));
    expect(await readSettings()).toMatchObject({ ok: true, settings: { lines: expect.any(Array) } });
  });

  it("reloads a same-size edit even when the modification timestamp is preserved", async () => {
    const path = await settingsPath();
    const timestamp = new Date("2026-01-01T00:00:00Z");
    await writeFile(path, JSON.stringify({ lines: [[{ type: "model", color: "red" }]] }));
    await utimes(path, timestamp, timestamp);
    expect(await readSettings()).toMatchObject({ ok: true, settings: { lines: [[{ color: "red" }]] } });
    // Ensure the metadata-change clock advances, while deliberately fixing mtime.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await writeFile(path, JSON.stringify({ lines: [[{ type: "model", color: "tan" }]] }));
    await utimes(path, timestamp, timestamp);
    expect(await readSettings()).toMatchObject({ ok: true, settings: { lines: [[{ color: "tan" }]] } });
  });
});
