// Diagnostic only: Codex input ensures the daemon reads no Claude settings.
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { factsOutputSchema } from "../shared/rpc";

const client = new DaemonClient({
  url: "ws://127.0.0.1:6767/ws",
  clientId: "ccstatusline-facts-check",
  reconnect: { enabled: false },
});
const directory = await mkdtemp(join(tmpdir(), "ccstatusline-facts-rpc-"));
try {
  await client.connect();
  for (const cwd of [process.cwd(), directory, join(directory, "missing")]) {
    const result = factsOutputSchema.parse(await client.invokePluginRpc("paseo-ccstatusline", "facts.read", { cwd, provider: "codex" }));
    if (!result.memory || result.outputStyle !== null || (cwd === process.cwd() ? !result.branch : result.branch !== null)) {
      throw new Error("Unexpected facts result");
    }
  }
  console.log("Facts RPC: Git, plain and missing cwd passed; memory present; Codex output style hidden.");
} catch {
  console.error("Facts RPC check failed; response contents omitted.");
  process.exitCode = 1;
} finally {
  await client.close();
  await rm(directory, { recursive: true, force: true });
}
