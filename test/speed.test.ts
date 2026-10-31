import { expect, it } from "vitest";
import { nextSpeed, type TokenSample } from "../shared/speed";

const previous: TokenSample = { atMs: 1000, input: 10, output: 20 };
const current: TokenSample = { atMs: 3000, input: 12, output: 220 };
const hidden = { input: null, output: null, total: null };

it("estimates speeds from token increases and elapsed seconds", () => {
  expect(nextSpeed(previous, current, true)).toEqual({ speed: { input: 1, output: 100, total: 101 }, sample: current });
});

it("hides speed without an earlier sample or while idle", () => {
  expect(nextSpeed(null, current, true)).toEqual({ speed: hidden, sample: current });
  expect(nextSpeed(previous, current, false).speed).toEqual(hidden);
});

it("hides a reset sample and accepts it as the next baseline", () => {
  const reset = { ...current, input: 1 };
  expect(nextSpeed(previous, reset, true)).toEqual({ speed: hidden, sample: reset });
});

it("hides unchanged samples and nonpositive time intervals", () => {
  expect(nextSpeed(previous, { ...previous, atMs: 4000 }, true).speed).toEqual(hidden);
  expect(nextSpeed(previous, { ...current, atMs: 1000 }, true).speed).toEqual(hidden);
  expect(nextSpeed(previous, { ...current, atMs: 0 }, true).speed).toEqual(hidden);
});

it("estimates a known direction but hides total when the other counter is missing", () => {
  expect(nextSpeed({ ...previous, input: null }, { ...current, input: null }, true).speed).toEqual({ input: null, output: 100, total: null });
});
