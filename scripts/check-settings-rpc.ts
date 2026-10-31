// Diagnostic only: the plugin itself uses Paseo's owned connection.
import { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { settingsOutputSchema } from "../shared/rpc";

const client = new DaemonClient({
  url: "ws://127.0.0.1:6767/ws",
  clientId: "ccstatusline-settings-check",
  reconnect: { enabled: false },
});

try {
  await client.connect();
  const result = settingsOutputSchema.parse(await client.invokePluginRpc("paseo-ccstatusline", "settings.read", {}));
  console.log(JSON.stringify(result.ok
    ? { ok: true, lineLengths: result.settings.lines.map((line) => line.length) }
    : { ok: false, reason: result.reason }));
  if (!result.ok) process.exitCode = 1;
} catch {
  console.error("Settings RPC check failed; response contents omitted.");
  process.exitCode = 1;
} finally {
  await client.close();
}
