import { listAgentUsage } from "../client/agent-usage";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createPaseoApi } from "@getpaseo/client";
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { settingsOutputSchema, factsOutputSchema } from "../shared/rpc";
import type { AgentFacts } from "../shared/facts";
import { buildLines, hoverText } from "../shared/widgets";
import { pillLabel } from "../shared/summary";
import { selectUsage } from "../shared/usage";

const daemon = new DaemonClient({ clientId: randomUUID(), url: "ws://127.0.0.1:6767/ws", reconnect: { enabled: false },
  logger: { debug() {}, info() {}, warn() {}, error() {} } });
const paseo = createPaseoApi(daemon);
const redact = (text: string) => text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<account email redacted>");
try {
  await daemon.connect();
  const settingsResult = settingsOutputSchema.parse(await daemon.invokePluginRpc("paseo-ccstatusline", "settings.read", {}));
  if (!settingsResult.ok) throw new Error("Settings RPC unavailable");
  const { entries } = await paseo.agents.list();
  const sections = [`# End-to-end checks, 2026-10-31\n\nCaptured at ${new Date().toISOString()}. Source implementation: 5ecc4b9.\n\nThis is an SDK and view-builder check, not a desktop render. Account email text is redacted before writing or printing. No timeline is read because no popover is open.\n\nSettings came from the running plugin's settings.read RPC. Facts came from its facts.read RPC; agents, model labels and usage came from the live SDK. The real buildLines, hoverText and pillLabel functions produced the values below.`];
  for (const provider of ["claude", "codex"]) {
    const agent = entries.find(({ agent }) => agent.provider === provider && !agent.archivedAt && agent.workspaceId)?.agent;
    if (!agent) throw new Error(`No eligible ${provider} agent`);
    const remote = factsOutputSchema.parse(await daemon.invokePluginRpc("paseo-ccstatusline", "facts.read", { cwd: agent.cwd, provider }));
    const catalog = await paseo.providers.listModels(provider);
    const usage = await listAgentUsage(paseo.agents.ref(agent.id));
    const selected = selectUsage(usage.reports);
    const model = agent.runtimeInfo?.model ?? agent.model;
    const facts: AgentFacts = {
      modelLabel: catalog.models?.find((item) => item.id === model || item.aliases?.includes(model ?? ""))?.label ?? model,
      contextUsed: agent.lastUsage?.contextWindowUsedTokens ?? null, contextMax: agent.lastUsage?.contextWindowMaxTokens ?? null,
      branch: remote.branch, cwd: agent.cwd, memory: remote.memory,
      tokens: { cached: agent.lastUsage?.cachedInputTokens ?? null, input: agent.lastUsage?.inputTokens ?? null, output: agent.lastUsage?.outputTokens ?? null },
      speed: { input: null, output: null, total: null }, usageAccount: selected.account,
      session: selected.session, weekly: selected.weekly,
      thinking: agent.runtimeInfo?.thinkingOptionId ?? agent.thinkingOptionId ?? null,
      skill: null, outputStyle: provider === "claude" ? remote.outputStyle : null,
    };
    const now = new Date();
    const { lines, hiddenTypes } = buildLines(settingsResult.settings, facts, now);
    const reasons: Record<string, string> = {
      model: "No model ID or label in the agent record/catalog.", "context-bar": "Context used/max values missing or invalid in lastUsage.",
      "git-branch": "facts.read returned null for the branch; Git branch unavailable.", "current-working-dir": "Agent cwd unavailable.",
      "free-memory": "facts.read returned no usable memory values.", "tokens-cached": "cachedInputTokens absent in lastUsage.",
      "tokens-input": "inputTokens absent in lastUsage.", "tokens-output": "outputTokens absent in lastUsage.",
      "input-speed": "One snapshot provides no earlier token/time sample.", "output-speed": "One snapshot provides no earlier token/time sample.",
      "total-speed": "One snapshot provides no earlier token/time sample.",
      "session-usage": "No unambiguous available five_hour usage percentage.", "weekly-usage": "No unambiguous available weekly usage percentage.",
      "reset-timer": "No valid five_hour resetsAt in the selected report.", "weekly-reset-timer": "No valid weekly resetsAt in the selected report.",
      "thinking-effort": "Neither runtimeInfo nor the agent record supplied thinkingOptionId.",
      skills: provider === "claude" ? "No popover open; timeline not read and no previously known skill in this probe." : "Codex has no reliable explicit skill-use shape; timeline not read.",
      "output-style": provider === "claude" ? "facts.read returned null for outputStyle." : "Output style is supported only for Claude.",
    };
    const hidden = new Map<string, string>();
    for (const widget of settingsResult.settings.lines.flat()) {
      const result = buildLines({ ...settingsResult.settings, lines: [[widget]] }, facts, now);
      if (!result.lines[0]?.length) hidden.set(widget.type, result.hiddenTypes.length ? "Unsupported widget type." : reasons[widget.type] ?? "No usable source value.");
    }
    sections.push(`## ${provider}\n\nAgent: ${agent.id}; status: ${agent.status}.\n\nPill: ${pillLabel(facts)}\n\nHover rows:\n\n\`\`\`text\n${hoverText(lines, facts.usageAccount)}\n\`\`\`\n\nHidden configured widgets (reasons: Recorded by hand):\n\n${[...hidden].map(([type, reason]) => `- ${type}: ${reason}`).join("\n") || "None."}\n\nUnsupported widget types: ${hiddenTypes.join(", ") || "none"}.`);
    console.log(`${provider}: real record + settings RPC + facts RPC + provider usage -> ${pillLabel(facts)}; hidden: ${[...hidden.keys()].join(", ") || "none"}`);
  }
  sections.push(`## Settings reload and lifecycle (Recorded by hand)\n\n- scripts/check-settings-reload.ts: PASS. Copied the fixture to a temporary directory, set CCSTATUSLINE_SETTINGS_PATH only in the script process, flipped globalBold, and confirmed the second server settings read returned the changed value. Removed the temporary copy and restored the process environment. Real settings and daemon environment were untouched.\n- plugin reload, then plugin ls: running, enabled yes, no error.\n- plugin disable, then plugin ls: disabled, enabled no, no error.\n- plugin enable, then plugin ls: running, enabled yes, no error.\n- plugin logs: normal stop/load/ready records during this check. Two earlier stderr entries at 2026-10-31T06:43:56.094Z and .095Z said “Cannot read Git branch; command output omitted.” No new lifecycle error appeared. This log tail does not prove the desktop client rendered successfully.\n\n## Desktop checks\n\n- Claude pill, hover and popover screenshots: Pending: needs desktop app.\n- Codex pill, hover and popover screenshots: Pending: needs desktop app.\n- Tab change and agent association screenshot: Pending: needs desktop app.\n- Saved settings change in rendered UI: Pending: needs desktop app.\n- Disable/enable removes and restores pills visually: Pending: needs desktop app.\n- Compact layout, long unbroken text, Powerline edge clipping and theme switching: Pending: needs desktop app.\n\n## Commands\n\nRun individually and awaited:\n\n- node_modules/.bin/tsx scripts/check-settings-reload.ts\n- /Applications/Paseo.app/Contents/Resources/bin/paseo plugin reload paseo-ccstatusline\n- /Applications/Paseo.app/Contents/Resources/bin/paseo plugin ls\n- /Applications/Paseo.app/Contents/Resources/bin/paseo plugin disable paseo-ccstatusline\n- /Applications/Paseo.app/Contents/Resources/bin/paseo plugin ls\n- /Applications/Paseo.app/Contents/Resources/bin/paseo plugin enable paseo-ccstatusline\n- /Applications/Paseo.app/Contents/Resources/bin/paseo plugin ls\n- /Applications/Paseo.app/Contents/Resources/bin/paseo plugin logs paseo-ccstatusline\n- node_modules/.bin/tsx scripts/check-real-views.ts\n\nThe pinned SDK exposes plugin RPC on its internal DaemonClient export, so the probe uses that transport with createPaseoApi for normal SDK operations. It does not access credentials or alter agent sessions.`);
  await writeFile(new URL("../docs/superpowers/spikes/2026-10-31-e2e.md", import.meta.url), redact(sections.join("\n\n")) + "\n");
  console.log("Wrote redacted docs/superpowers/spikes/2026-10-31-e2e.md; lifecycle results and hidden-widget reasons: Recorded by hand");
} catch {
  console.error("Real-view check failed; raw response and error details omitted.");
  process.exitCode = 1;
} finally { await daemon.close(); }
