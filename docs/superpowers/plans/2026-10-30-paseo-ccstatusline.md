# paseo-ccstatusline Implementation Plan

> **For agentic workers:** Follow this plan one task at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Paseo plugin that shows the `ccstatusline` layout for each agent. It has a composer pill summary, a hover text view and a colored popover.

**Architecture:** Pure TypeScript modules in `shared/` turn settings and facts into segments. A daemon handler reads local files and runs `git`. App code owns one pill for each agent and draws the segments.

**Tech Stack:** TypeScript, React Native primitives, Zod, Vitest, `@getpaseo/plugin` 0.14.0, `@getpaseo/client` 0.14.0.

**Spec:** `docs/superpowers/specs/2026-10-30-paseo-ccstatusline-design.md`. Read it first. The spec owns all widget, color, data and update rules.

## Global Constraints

- Plugin ID and package name: `paseo-ccstatusline`. License: MIT.
- `requirements.paseo` is `>=0.14.0`. Every API must exist in 0.14.0.
- CLI path: `/Applications/Paseo.app/Contents/Resources/bin/paseo`.
- Do not restart the Paseo daemon. Use `paseo plugin reload paseo-ccstatusline`.
- Do not edit `~/.config/ccstatusline/settings.json` or other Claude Code files.
- Do not read OAuth tokens or print credentials. Do not publish or push.
- Client code uses React Native primitives only, with no Node APIs and no DOM APIs.
- Run one test file for each command, and wait for it to finish. Do not run long commands in the background.
- Do not use `git stash`. To test an old commit, use `git worktree add /tmp/<name> <sha>`.
- Keep helper scripts in `scripts/` in this repository, not in `/tmp`.
- Each task has one test commit and then one implementation commit. Task 1 has no test commit.

## Review Focus

Each line has a test in the named task:

1. An agent `cwd` that is not a Git folder, or that no longer exists, hides the branch and keeps the other widgets. Task 4.
2. A settings file with no lines, a bad widget entry or a new unknown type gives a message or a hidden widget, and no crash. Task 2 and Task 3.
3. Context use above the maximum shows 100%. A maximum of 0 hides the context value. Task 3.
4. A reconnect snapshot replaces all pills, and an update after a removal does nothing. Task 5.
5. A long `cwd` or skill name wraps inside the popover and does not leave its area. Task 6.

---

### Task 1: Plugin project and blocking checks

This task can change the design, so stop after it and report.

**Files:**
- Create: `paseo-plugin.json`, `package.json`, `tsconfig.json`, `OVERVIEW.md`, `LICENSE`, `index.client.tsx`, `vitest.config.ts`
- Create: `scripts/dump-usage-reports.ts`
- Create: `scripts/inspect-skill-timelines.ts`
- Create: `docs/superpowers/spikes/2026-10-30-checks.md`

**Interfaces:**
- Produces: a project that passes `npm run typecheck`, a test command `npm test -- <file>`, and the check report.

- [ ] **Step 1: Create the project with `paseo plugin init` in a temporary folder, and copy its files to the repository root**

Set the manifest `id` and `requirements` from Global Constraints. Pin `@getpaseo/plugin` and `@getpaseo/client` to 0.14.0. Add Vitest.

- [ ] **Step 2: Add one test pill to `index.client.tsx` with a five-row `title`**

Use the five example rows from the spec, joined with `\n`. Follow `plugin-examples/local-plugin/client/main.tsx` in `/Volumes/WDSN580/src/paseo-work/paseo`.

- [ ] **Step 3: Install the plugin and test the real tooltip**

Run: `paseo plugin install <absolute repo path>`, then `paseo plugin ls`.
Expected: `paseo-ccstatusline` is `running` with no error. Then use the desktop app or the daemon web UI. Record the number of readable tooltip rows. Save a screenshot in `docs/superpowers/spikes/`.

If you cannot operate the desktop app from your session, report this as a blocker and do not guess.

- [ ] **Step 4: Write `scripts/dump-usage-reports.ts` and record the real report shape**

The script prints only `providerId`, `displayName`, `status`, and each window `id`, `label`, `shortLabel`, `usedPct`, `resetsAt`. Record the results for Claude, Codex and ZeroSub. Answer this question: can a report describe a different account than an agent uses?

- [ ] **Step 5: Record the skill use shape in Claude and Codex timelines**

Read recent timeline items through the SDK for one agent of each provider. Record the exact tool-call fields that name a skill, or record that no reliable shape exists.

- [ ] **Step 6: Write the results in `docs/superpowers/spikes/2026-10-30-checks.md`, commit, and stop**

```bash
git add -A
git commit -m "chore: create plugin project and record blocking checks"
```

Report the SHA, the commands, the three results and any conflict with the spec.

### Task 2: Settings and theme colors

**Files:**
- Create: `shared/settings.ts`, `shared/themes.ts`, `shared/colors.ts`, `THIRD_PARTY_NOTICES.md`
- Create: `server/settings.ts`, `shared/rpc.ts`
- Modify: `index.server.ts`
- Test: `test/settings.test.ts`, `test/colors.test.ts`, `test/fixtures/settings.json`

**Interfaces:**
- Produces:
  - `parseSettings(raw: unknown): StatusSettings`, which throws `SettingsError` with a reason.
  - `type StatusSettings = { lines: WidgetConfig[][]; colorLevel: number; globalBold: boolean; powerline: { enabled: boolean; theme: string; continueThemeAcrossLines: boolean } }`
  - `type WidgetConfig = { id: string; type: string; color?: string; backgroundColor?: string; rawValue?: boolean }`
  - `themeColors(settings: StatusSettings, slot: number): { fg: string; bg: string }`, which returns hex values.
  - `toHex(color: string): string | null` for named, `ansi256:` and `hex:` colors.
  - RPC `settings.read`, output `{ ok: true; settings: StatusSettings; path: string } | { ok: false; path: string; reason: string }`.

- [ ] **Step 1: Write failing tests**

Copy the real file shape to the fixture. Assert:

```ts
expect(parseSettings(fixture).lines.map((l) => l.length)).toEqual([3, 2, 6, 4, 3]);
expect(themeColors(s, 0)).toEqual({ fg: "#ffffff", bg: "#af5f5f" });
expect(themeColors(s, 1)).toEqual({ fg: "#000000", bg: "#ffd700" });
expect(themeColors(s, 2)).toEqual({ fg: "#ffffff", bg: "#5f87d7" });
expect(themeColors(s, 3)).toEqual({ fg: "#000000", bg: "#87af87" });
expect(themeColors(s, 4)).toEqual({ fg: "#000000", bg: "#d787d7" });
expect(themeColors(s, 5)).toEqual(themeColors(s, 0));
expect(() => parseSettings({ lines: "x" })).toThrow(SettingsError);
expect(parseSettings({ lines: [] }).lines).toEqual([]);
```

Also test that an entry without a string `type` is dropped and its neighbors stay.

- [ ] **Step 2: Run the tests and make sure that they fail, then commit the tests**

Run: `npm test -- test/settings.test.ts`, then `npm test -- test/colors.test.ts`.
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the modules**

Copy the theme table from `/tmp/ccsl-src/package/dist/ccstatusline-9c4ne7jz.js`, and add the MIT notice to `THIRD_PARTY_NOTICES.md`. If `/tmp/ccsl-src` is gone, run `npm pack ccstatusline@2.2.33` in a new temporary folder. `server/settings.ts` reads `CCSTATUSLINE_SETTINGS_PATH` or the default path, and it uses the file modification time to reuse the parsed result.

- [ ] **Step 4: Run the tests and typecheck, then commit**

Run: `npm test -- test/settings.test.ts`, `npm test -- test/colors.test.ts`, `npm run typecheck`.
Expected: PASS.

### Task 3: Widget text, segments and pill summary

**Files:**
- Create: `shared/facts.ts`, `shared/widgets.ts`, `shared/summary.ts`, `shared/usage.ts`, `shared/speed.ts`
- Test: `test/widgets.test.ts`, `test/summary.test.ts`, `test/usage.test.ts`, `test/speed.test.ts`

**Interfaces:**
- Consumes: `StatusSettings`, `themeColors` from Task 2.
- Produces:
  - `type AgentFacts = { modelLabel: string | null; contextUsed: number | null; contextMax: number | null; branch: string | null; cwd: string | null; memory: { used: number; total: number } | null; tokens: { cached: number | null; input: number | null; output: number | null }; speed: { input: number | null; output: number | null; total: number | null }; usageAccount: string | null; session: UsageWindow | null; weekly: UsageWindow | null; thinking: string | null; skill: string | null; outputStyle: string | null }`
  - `type UsageWindow = { usedPct: number | null; resetsAt: string | null }`
  - `type Segment = { text: string; fg: string; bg: string; estimate: boolean }`
  - `buildLines(settings: StatusSettings, facts: AgentFacts, now: Date): { lines: Segment[][]; hiddenTypes: string[] }`
  - `hoverText(lines: Segment[][], usageAccount: string | null): string`, with `Usage: <account>` as the first row if an account is known.
  - `plainText(lines: Segment[][]): string`, with ` | ` between segments and `\n` between rows.
  - `pillLabel(facts: AgentFacts): string`
  - `contextPercent(facts: AgentFacts): number | null`
  - `type ProviderUsageEntry = PaseoProviderUsageResult["providers"][number]`
  - `selectUsage(entries: ProviderUsageEntry[], provider: string): { account: string | null; session: UsageWindow | null; weekly: UsageWindow | null }`, which matches `providerId` and the window IDs `five_hour` and `weekly`.
  - `nextSpeed(previous: TokenSample | null, current: TokenSample, running: boolean): { speed: AgentFacts["speed"]; sample: TokenSample }`

- [ ] **Step 1: Write failing tests**

Use the example values from the spec. Assert these results:

```ts
expect(plainText(lines).split("\n")[0]).toBe("Model: Opus 5.5 | Context: [████████████░░░░] 147k/200k (74%) | ⎇ main");
expect(lines[3].map((s) => s.text)).toEqual(["Reset: 2hr 27m", "5h: 63.0%", "Weekly Reset: 4d 20hr 7m", "Weekly: 39.0%"]);
expect(pillLabel(all)).toBe("74% · 63% · 39%");
expect(pillLabel(noUsage)).toBe("74% · -- · --");
expect(pillLabel(nothing)).toBe("-- · -- · --");
expect(contextPercent({ ...all, contextUsed: 300, contextMax: 200 })).toBe(100);
expect(contextPercent({ ...all, contextMax: 0 })).toBeNull();
```

Also test these cases:
- A hidden `git-branch` does not use a color slot, so the next segment takes its colors.
- Colors restart on each line. If `continueThemeAcrossLines` is true, they continue across lines.
- With `powerline.enabled` false, each segment uses its widget `color` and `backgroundColor`.
- Each of the 18 widget types has one text test, with values taken from `ccstatusline` 2.2.33 output.
- An unknown type appears in `hiddenTypes` and does not stop the line.
- Speed segments have `estimate: true`.
- `selectUsage` returns nulls for no report, for two reports with one `providerId`, and for a report with `status` other than `available`.
- `nextSpeed` returns nulls for no earlier sample, for a count decrease and for an idle agent.

Use the window shapes from `docs/superpowers/spikes/2026-10-30-checks.md` for the `selectUsage` fixtures. Also assert that `selectUsage` returns the `displayName` as `account`, and that `hoverText` starts with `Usage: <account>`.

- [ ] **Step 2: Run the tests and make sure that they fail, then commit the tests**

Run each test file in its own `npm test -- <file>` command.
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the modules**

Read the `ccstatusline` 2.2.33 source for text formats. Keep the modules free of React Native and Node imports.

- [ ] **Step 4: Run each test file and typecheck, then commit**

Expected: PASS.

### Task 4: Daemon facts

**Files:**
- Create: `server/facts.ts`
- Modify: `shared/rpc.ts`, `index.server.ts`
- Test: `test/server-facts.test.ts`

**Interfaces:**
- Consumes: `shared/rpc.ts` from Task 2.
- Produces: RPC `facts.read`, input `{ cwd: string; provider: string }`, output `{ branch: string | null; memory: { used: number; total: number } | null; outputStyle: string | null }`. Results are cached for 5 seconds by `cwd` and provider.

- [ ] **Step 1: Write failing tests**

Use real temporary folders and a real `git init`. Assert these results:
- A Git folder returns its branch.
- A plain folder and a missing folder return `branch: null`, with `memory` present.
- `outputStyle` follows the spec order and returns `simple-english` for `simple-english:simple-english`.
- `outputStyle` is null for `provider: "codex"`, and for a file with invalid JSON.
- The test sets `CLAUDE_CONFIG_DIR` to a temporary folder, so it never reads the real settings.

- [ ] **Step 2: Run the test and make sure that it fails, then commit the test**

Run: `npm test -- test/server-facts.test.ts`.
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement `readFacts(input: { cwd: string; provider: string }): Promise<FactsOutput>` in `server/facts.ts`**

Use `execFile` with `git branch --show-current` and a 2-second timeout. Use the same memory calculation as `ccstatusline`. Read only the `outputStyle` field. Log failures with `console.error`, without file contents.

- [ ] **Step 4: Run the test and typecheck, then commit**

Expected: PASS.

### Task 5: Agent store and pills

**Files:**
- Create: `client/store.ts`, `client/pills.tsx`, `client/context-icon.tsx`
- Modify: `index.client.tsx`
- Test: `test/store.test.ts`, `test/pills.test.ts`

**Interfaces:**
- Consumes: `buildLines`, `plainText`, `pillLabel`, `contextPercent`, `selectUsage`, `nextSpeed`, RPC `settings.read`, RPC `facts.read`.
- Produces:
  - `createStatusStore(deps: { readSettings; readFacts; listUsage; listModels; now }): StatusStore`
  - `StatusStore` has `setAgents`, `upsertAgent`, `removeAgent`, `getView(agentId): AgentView | null`, `subscribe(listener)` and `stop()`.
  - `type AgentView = { label: string; title: string; usageAccount: string | null; contextPercent: number | null; lines: Segment[][]; hiddenTypes: string[]; settingsError: string | null }`
  - `reconcilePills(previous: Map<string, PillRecord>, next: AgentRecord[]): { add: AgentRecord[]; remove: string[] }`

- [ ] **Step 1: Write failing tests**

Use fake timers and fake dependencies. Assert these results:
- A snapshot replaces all earlier agents, and `reconcilePills` removes pills for missing and archived agents.
- A snapshot after a reconnect does not leave old pills.
- An update after `removeAgent` does nothing and starts no timer.
- Many updates in one second cause one listener call.
- An update with the same view causes no listener call.
- Facts run once for each distinct `cwd` in each 30-second period.
- Usage runs once in each 60-second period for all agents.
- A failed facts call keeps the last value for 5 minutes, and it then gives null.
- After `stop()`, no timers remain.

- [ ] **Step 2: Run the tests and make sure that they fail, then commit the tests**

Run each test file in its own `npm test -- <file>` command.
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the store, pills and icon**

The icon component reads `contextPercent` with `useSyncExternalStore` by `agentId`, and it draws to the `size` prop. Register one stable icon component. Use the owned `agents.list({ subscribe: {} })` subscription. Read `lastUsage` and `runtimeInfo` from the SDK agent record. Get the model label from the provider model list. Set `title` to `hoverText(...)`.

- [ ] **Step 4: Run each test file and typecheck, then commit**

Expected: PASS.

### Task 6: Popover and skill value

**Files:**
- Create: `client/popover.tsx`, `client/segment-row.tsx`, `shared/skills.ts`
- Modify: `client/pills.tsx`, `client/store.ts`
- Test: `test/skills.test.ts`, `test/segment-layout.test.ts`

**Interfaces:**
- Consumes: `StatusStore`, `Segment`.
- Produces: `lastSkill(items: TimelineItem[], provider: string): string | null`, and `segmentRowStyle(): ViewStyle`.

- [ ] **Step 1: Write failing tests**

Use the shapes from `docs/superpowers/spikes/2026-10-30-checks.md` as fixtures: a Claude `tool_call` with `name` `Skill` and `detail.label`, and a Codex list with no such item. Assert these results:
- `lastSkill` returns the newest skill.
- `lastSkill` returns null for a provider with no reliable shape.
- `segmentRowStyle()` has `flexWrap: "wrap"`, and the outer view style has `maxWidth: "100%"`, so long text wraps inside the popover.

- [ ] **Step 2: Run the tests and make sure that they fail, then commit the tests**

Run each test file in its own `npm test -- <file>` command.
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the popover**

Show the agent title, a muted `Usage: <account>` row if an account is known, the rows, a muted line for `hiddenTypes`, and `settingsError` with the path. Use `theme.colors` for all text outside segments. Set `fontStyle: "italic"` for segments with `estimate: true`. Draw separators without a Powerline font. While the popover is open, refresh each 5 seconds and read the recent timeline for the skill.

- [ ] **Step 4: Run each test file, typecheck and the DOM audit, then commit**

Run: `rg -n "document\.|window\.|localStorage|navigator\.|<[a-z]+[ >]|className=|onClick=" client/`
Expected: no hits, and all tests PASS.

### Task 7: End-to-end proof and overview

**Files:**
- Modify: `OVERVIEW.md`
- Create: `docs/superpowers/spikes/2026-10-30-e2e.md` and its screenshots

- [ ] **Step 1: Write `OVERVIEW.md`**

Say what the plugin does, what it reads, its limits, and that token widgets show last-report values. Do not include install commands, badges or marketing text.

- [ ] **Step 2: Reload the plugin and make sure that it runs**

Run: `paseo plugin reload paseo-ccstatusline`, then `paseo plugin ls`.
Expected: `running` with no error.

- [ ] **Step 3: Do verification items 5 and 6 from the spec**

Save the screenshots, and write the results in `docs/superpowers/spikes/2026-10-30-e2e.md`. Include a Claude agent, a Codex agent, a tab change, a test configuration change, and plugin disable and enable.

- [ ] **Step 4: Commit and report**

```bash
git add -A
git commit -m "docs: add overview and end-to-end proof"
```
