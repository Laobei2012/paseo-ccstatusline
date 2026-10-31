import { type AgentFacts, type UsageWindow, isNonNegativeNumber } from "./facts";
import type { StatusSettings } from "./settings";
import { toHex } from "./colors";
import { builtInThemes, themeColors } from "./themes";
import { contextPercent } from "./summary";

export type Segment = { text: string; fg: string; bg: string; estimate: boolean };

// Default formats follow ccstatusline 2.2.33. See THIRD_PARTY_NOTICES.md.
function tokens(value: number, decimals = 1): string {
  if (value >= 1e6 - 500 / 10 ** decimals) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(decimals)}k`;
  return String(value);
}

function bytes(value: number): string {
  if (value >= 1024 ** 2 * 1023.5) return `${(value / 1024 ** 3).toFixed(1)}G`;
  if (value >= 1024 * 1023.5) return `${(value / 1024 ** 2).toFixed(0)}M`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)}K`;
  return `${value}B`;
}

function reset(window: UsageWindow | null, now: Date): string | null {
  if (!window?.resetsAt) return null;
  const duration = Date.parse(window.resetsAt) - now.getTime();
  if (!Number.isFinite(duration)) return null;
  const minutes = Math.floor(Math.max(0, duration) / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes / 60) % 24;
  const remainder = minutes % 60;
  return [days ? `${days}d` : "", hours ? `${hours}hr` : "", remainder ? `${remainder}m` : ""].filter(Boolean).join(" ") || "0m";
}

function labeled(label: string, value: string | null): string | null {
  return value ? `${label}${value}` : null;
}

function tokenText(label: string, value: number | null): string | null {
  return isNonNegativeNumber(value) ? `${label}${tokens(value)}` : null;
}

function speedText(label: string, value: number | null): string | null {
  if (!isNonNegativeNumber(value)) return null;
  return `${label}${value >= 999.95 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(1)} t/s`;
}

function percentText(label: string, window: UsageWindow | null): string | null {
  return isNonNegativeNumber(window?.usedPct) ? `${label}${window.usedPct.toFixed(1)}%` : null;
}

// null means a known widget has no value; undefined means an unsupported type.
function widgetText(type: string, facts: AgentFacts, now: Date): string | null | undefined {
  switch (type) {
    case "model": return labeled("Model: ", facts.modelLabel);
    case "context-bar": {
      const percent = contextPercent(facts);
      if (percent === null) return null;
      const filled = Math.round(percent / 100 * 16);
      return `Context: [${"█".repeat(filled)}${"░".repeat(16 - filled)}] ${tokens(facts.contextUsed!, 0)}/${tokens(facts.contextMax!, 0)} (${Math.round(percent)}%)`;
    }
    case "git-branch": return labeled("⎇ ", facts.branch);
    case "current-working-dir": return labeled("cwd: ", facts.cwd);
    case "free-memory": return facts.memory && isNonNegativeNumber(facts.memory.used) && isNonNegativeNumber(facts.memory.total) && facts.memory.total > 0
      ? `Mem: ${bytes(facts.memory.used)}/${bytes(facts.memory.total)}` : null;
    case "tokens-cached": return tokenText("Cached: ", facts.tokens.cached);
    case "tokens-input": return tokenText("In: ", facts.tokens.input);
    case "tokens-output": return tokenText("Out: ", facts.tokens.output);
    case "input-speed": return speedText("In: ", facts.speed.input);
    case "output-speed": return speedText("Out: ", facts.speed.output);
    case "total-speed": return speedText("Total: ", facts.speed.total);
    case "reset-timer": return labeled("Reset: ", reset(facts.session, now));
    case "session-usage": return percentText("5h: ", facts.session);
    case "weekly-reset-timer": return labeled("Weekly Reset: ", reset(facts.weekly, now));
    case "weekly-usage": return percentText("Weekly: ", facts.weekly);
    case "thinking-effort": return labeled("Thinking: ", facts.thinking);
    case "skills": return labeled("Skill: ", facts.skill);
    case "output-style": return labeled("Style: ", facts.outputStyle);
    default: return undefined;
  }
}

export function buildLines(settings: StatusSettings, facts: AgentFacts, now: Date): { lines: Segment[][]; hiddenTypes: string[] } {
  const hiddenTypes = new Set<string>();
  const theme = settings.powerline.theme;
  const useTheme = settings.powerline.enabled && theme !== undefined && theme !== "custom" && Object.hasOwn(builtInThemes, theme);
  let slot = 0;
  const lines = settings.lines.map((line) => {
    if (!settings.powerline.continueThemeAcrossLines) slot = 0;
    const segments: Segment[] = [];
    for (const widget of line) {
      const text = widgetText(widget.type, facts, now);
      if (text === undefined) hiddenTypes.add(widget.type);
      if (text == null) continue;
      const colors = useTheme ? themeColors(settings, slot) : {
        fg: toHex(widget.color ?? "white", settings.colorLevel) ?? "#d3d7cf",
        bg: toHex(widget.backgroundColor ?? "black", settings.colorLevel) ?? "#000000",
      };
      segments.push({ text, ...colors, estimate: widget.type.endsWith("-speed") });
      slot++;
    }
    return segments;
  });
  return { lines, hiddenTypes: [...hiddenTypes] };
}

export function plainText(lines: Segment[][]): string {
  return lines.filter((line) => line.length > 0).map((line) => line.map((segment) => segment.text).join(" | ")).join("\n");
}

export function hoverText(lines: Segment[][], usageAccount: string | null): string {
  return [usageAccount ? `Usage: ${usageAccount}` : "", plainText(lines)].filter(Boolean).join("\n");
}
