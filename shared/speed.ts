import { type AgentFacts, isNonNegativeNumber } from "./facts";

// atMs is a timestamp in milliseconds. Counts are the latest report, not sums.
export type TokenSample = { atMs: number; input: number | null; output: number | null };

export function nextSpeed(previous: TokenSample | null, current: TokenSample, running: boolean): {
  speed: AgentFacts["speed"]; sample: TokenSample;
} {
  const hidden = { speed: { input: null, output: null, total: null }, sample: current };
  if (!running || !previous || !Number.isFinite(current.atMs) || !Number.isFinite(previous.atMs) || current.atMs <= previous.atMs) return hidden;
  const seconds = (current.atMs - previous.atMs) / 1000;
  const delta = (before: number | null, after: number | null) =>
    isNonNegativeNumber(before) && isNonNegativeNumber(after) ? after - before : null;
  const input = delta(previous.input, current.input);
  const output = delta(previous.output, current.output);
  // A decreased count indicates a reset; do not mix measurements across turns.
  if ((input !== null && input < 0) || (output !== null && output < 0)) return hidden;
  const total = input !== null && output !== null ? input + output : null;
  const rate = (count: number | null) => count !== null && count > 0 && Number.isFinite(count / seconds) ? count / seconds : null;
  return { speed: { input: rate(input), output: rate(output), total: rate(total) }, sample: current };
}
