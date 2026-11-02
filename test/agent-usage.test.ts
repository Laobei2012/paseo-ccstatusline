import { expect, it, vi } from "vitest";
import type { PaseoAgentHandle } from "@getpaseo/client";
import { listAgentUsage } from "../client/agent-usage";

it("hides usage on an older app SDK without requesting host-wide usage", async () => {
  expect(await listAgentUsage({} as PaseoAgentHandle)).toEqual({ requestId: "", reports: [], usageRevision: null });
});

it("calls the new method with its agent handle receiver and preserves the native result", async () => {
  const result = { requestId: "r", reports: [], usageRevision: "launch" };
  const handle = { listUsageReports: vi.fn(function (this: unknown) { expect(this).toBe(handle); return Promise.resolve(result); }) };
  expect(await listAgentUsage(handle as unknown as PaseoAgentHandle)).toBe(result);
});
