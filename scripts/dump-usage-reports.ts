import { createPaseoClient } from "@getpaseo/client";

const redact = (text: string) => text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<account email redacted>");

const client = createPaseoClient({ url: "ws://127.0.0.1:6767/ws", reconnect: { enabled: false }, logger: { debug() {}, info() {}, warn() {}, error() {} } });
try {
  await client.connect();
  const { providers } = await client.providers.listUsage();
  console.log(redact(JSON.stringify(providers.map(({ providerId, displayName, status, windows }) => ({
    providerId, displayName, status,
    windows: windows.map(({ id, label, shortLabel, usedPct, resetsAt }) => ({ id, label, shortLabel, usedPct, resetsAt })),
  })), null, 2)));
} catch {
  console.error("Usage report probe failed; no response contents logged.");
  process.exitCode = 1;
} finally {
  await client.close();
}
