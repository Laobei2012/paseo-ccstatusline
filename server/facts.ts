import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { freemem, homedir, platform, totalmem } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { FactsOutput } from "../shared/rpc";

const run = promisify(execFile);
const cache = new Map<string, { expiresAt: number; result: Promise<FactsOutput> }>();

async function readBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await run("git", ["branch", "--show-current"], { cwd, timeout: 2_000, windowsHide: true });
    return stdout.trim() || null;
  } catch (error) {
    const code = (error as { code?: number | string }).code;
    if (code !== 128 && code !== "ENOENT") console.error("Cannot read Git branch; command output omitted.");
    return null;
  }
}

async function readMemory(): Promise<FactsOutput["memory"]> {
  try {
    const total = totalmem();
    if (platform() === "darwin") {
      try {
        const { stdout } = await run("vm_stat", [], { timeout: 2_000, windowsHide: true });
        const pageSize = /page size of (\d+) bytes/.exec(stdout.split("\n")[0])?.[1];
        if (pageSize) {
          const active = Number(/Pages active:\s+(\d+)/.exec(stdout)?.[1] ?? 0);
          const wired = Number(/Pages wired down:\s+(\d+)/.exec(stdout)?.[1] ?? 0);
          return { used: (active + wired) * Number(pageSize), total };
        }
        console.error("Cannot parse memory statistics; using free memory fallback.");
      } catch {
        console.error("Cannot read memory statistics; using free memory fallback.");
      }
    }
    return { used: total - freemem(), total };
  } catch {
    console.error("Cannot read system memory.");
    return null;
  }
}

async function readOutputStyle(cwd: string, provider: string): Promise<string | null> {
  if (provider !== "claude") return null;
  const paths = [
    join(cwd, ".claude", "settings.local.json"),
    join(cwd, ".claude", "settings.json"),
    join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "settings.json"),
  ];
  for (const path of paths) {
    try {
      const raw: unknown = JSON.parse(await readFile(path, "utf8"));
      if (raw === null || typeof raw !== "object" || !("outputStyle" in raw)) continue;
      const style = raw.outputStyle;
      if (typeof style !== "string" || !style.trim()) continue;
      return style.slice(style.lastIndexOf(":") + 1) || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Cannot read Claude output style; settings contents omitted.");
      }
    }
  }
  return null;
}

export async function readFacts(input: { cwd: string; provider: string }): Promise<FactsOutput> {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  const key = JSON.stringify([input.cwd, input.provider]);
  const existing = cache.get(key);
  if (existing) return existing.result;
  const result = Promise.all([
    readBranch(input.cwd), readMemory(), readOutputStyle(input.cwd, input.provider),
  ]).then(([branch, memory, outputStyle]) => ({ branch, memory, outputStyle }));
  cache.set(key, { expiresAt: now + 5_000, result });
  return result;
}
