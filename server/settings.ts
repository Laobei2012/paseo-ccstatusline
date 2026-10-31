import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseSettings, SettingsError } from "../shared/settings";
import type { SettingsOutput } from "../shared/rpc";

let cached: { path: string; mtimeMs: number; ctimeMs: number; size: number; result: SettingsOutput } | undefined;

export async function readSettings(): Promise<SettingsOutput> {
  const path = process.env.CCSTATUSLINE_SETTINGS_PATH || join(homedir(), ".config", "ccstatusline", "settings.json");
  try {
    const info = await stat(path);
    if (cached?.path === path && cached.mtimeMs === info.mtimeMs && cached.ctimeMs === info.ctimeMs && cached.size === info.size) return cached.result;
    let result: SettingsOutput;
    try {
      const raw: unknown = JSON.parse(await readFile(path, "utf8"));
      result = { ok: true, path, settings: parseSettings(raw) };
    } catch (error) {
      if (error instanceof SettingsError) result = { ok: false, path, reason: error.message };
      else if (error instanceof SyntaxError) result = { ok: false, path, reason: "Invalid JSON." };
      else throw error;
    }
    cached = { path, mtimeMs: info.mtimeMs, ctimeMs: info.ctimeMs, size: info.size, result };
    return result;
  } catch (error) {
    cached = undefined;
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, path, reason: code === "ENOENT" ? "Settings file not found." : "Cannot read settings file." };
  }
}
