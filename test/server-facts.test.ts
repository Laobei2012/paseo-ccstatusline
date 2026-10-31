import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFacts } from "../server/facts";

const run = promisify(execFile);

describe("daemon facts", () => {
  let root: string;
  let cwd: string;
  let config: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "ccstatusline-facts-"));
    cwd = join(root, "workspace");
    config = join(root, "user-config");
    await mkdir(join(cwd, ".claude"), { recursive: true });
    await mkdir(config);
    // Every read, including invalid/missing-file cases, is isolated from real settings.
    vi.stubEnv("CLAUDE_CONFIG_DIR", config);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  async function style(path: string, outputStyle: unknown) {
    await writeFile(path, JSON.stringify({ outputStyle, unrelatedPrivateField: "do not return" }));
  }

  it("reads the current branch from a real Git folder", async () => {
    await run("git", ["init", "--initial-branch=facts-test", cwd]);
    expect(await readFacts({ cwd, provider: "claude" })).toMatchObject({ branch: "facts-test" });
  });

  it.each(["plain", "missing"])("keeps memory when the cwd is %s", async (kind) => {
    const result = await readFacts({ cwd: kind === "plain" ? cwd : join(root, "missing"), provider: "codex" });
    expect(result.branch).toBeNull();
    expect(result.memory).not.toBeNull();
    expect(result.memory!.total).toBeGreaterThan(0);
    expect(result.memory!.used).toBeGreaterThanOrEqual(0);
    expect(result.memory!.used).toBeLessThanOrEqual(result.memory!.total);
  });

  it("prefers project local settings and removes the namespace", async () => {
    await style(join(config, "settings.json"), "user");
    await style(join(cwd, ".claude/settings.json"), "project");
    await style(join(cwd, ".claude/settings.local.json"), "simple-english:simple-english");
    const result = await readFacts({ cwd, provider: "claude" });
    expect(result.outputStyle).toBe("simple-english");
    expect(result).not.toHaveProperty("unrelatedPrivateField");
  });

  it("uses project settings before user settings", async () => {
    await style(join(config, "settings.json"), "user");
    await style(join(cwd, ".claude/settings.json"), "project");
    expect((await readFacts({ cwd, provider: "claude" })).outputStyle).toBe("project");
  });

  it("uses CLAUDE_CONFIG_DIR when project files have no output style", async () => {
    await writeFile(join(cwd, ".claude/settings.local.json"), JSON.stringify({ other: "value" }));
    await style(join(config, "settings.json"), "namespace:team:concise");
    expect((await readFacts({ cwd, provider: "claude" })).outputStyle).toBe("concise");
  });

  it("hides output style for Codex even when Claude settings exist", async () => {
    await style(join(cwd, ".claude/settings.local.json"), "simple-english");
    expect((await readFacts({ cwd, provider: "codex" })).outputStyle).toBeNull();
  });

  it("hides output style when settings files are missing", async () => {
    expect((await readFacts({ cwd, provider: "claude" })).outputStyle).toBeNull();
  });

  it("handles invalid JSON without logging file contents", async () => {
    await writeFile(join(cwd, ".claude/settings.local.json"), "{private-content");
    expect((await readFacts({ cwd, provider: "claude" })).outputStyle).toBeNull();
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-content");
  });

  it.each([null, 42, {}, ""])("hides an invalid outputStyle: %j", async (value) => {
    await style(join(config, "settings.json"), value);
    expect((await readFacts({ cwd, provider: "claude" })).outputStyle).toBeNull();
  });

  it("caches facts for five seconds and then reads a saved change", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    await style(join(config, "settings.json"), "first");
    expect((await readFacts({ cwd, provider: "claude" })).outputStyle).toBe("first");
    await style(join(config, "settings.json"), "second");
    now = 5_999;
    expect((await readFacts({ cwd, provider: "claude" })).outputStyle).toBe("first");
    now = 6_000;
    expect((await readFacts({ cwd, provider: "claude" })).outputStyle).toBe("second");
  });

  it("keeps different working directories and providers separate in the cache", async () => {
    const other = join(root, "other");
    await mkdir(join(other, ".claude"), { recursive: true });
    await style(join(cwd, ".claude/settings.local.json"), "first");
    await style(join(other, ".claude/settings.local.json"), "second");
    expect((await readFacts({ cwd, provider: "claude" })).outputStyle).toBe("first");
    expect((await readFacts({ cwd: other, provider: "claude" })).outputStyle).toBe("second");
    expect((await readFacts({ cwd, provider: "codex" })).outputStyle).toBeNull();
  });
});
