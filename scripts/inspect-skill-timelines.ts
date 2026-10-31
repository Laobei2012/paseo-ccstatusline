import { createPaseoClient } from "@getpaseo/client";
const client = createPaseoClient({ url: "ws://127.0.0.1:6767/ws", reconnect: { enabled: false }, logger: { debug() {}, info() {}, warn() {}, error() {} } });
try {
  await client.connect();
  const { entries } = await client.agents.list();
  for (const provider of ["claude", "codex"]) {
    const entry = entries.find(({ agent }) => agent.provider === provider && !agent.archivedAt);
    if (!entry) { console.log(JSON.stringify({ provider, found: false })); continue; }
    const page = await client.agents.ref(entry.agent.id).timeline.refetch({ limit: 100 });
    console.log(JSON.stringify({ provider, agentId: entry.agent.id, keys: Object.keys(page) }));
    const items = (page as unknown as { entries?: unknown[]; items?: unknown[] }).entries ?? (page as unknown as { items?: unknown[] }).items ?? [];
    // Print structure and explicit skill identifiers only, never general tool arguments or outputs.
    const shapes = new Map<string, unknown>();
    const skills: unknown[] = [];
    for (const value of items) {
      const outer = value as Record<string, unknown>;
      const item = (outer.item ?? outer) as Record<string, unknown>;
      if (item.type !== "tool_call") continue;
      shapes.set(String(item.name), { type: item.type, name: item.name, keys: Object.keys(item), detailKeys: Object.keys((item.detail ?? {}) as object) });
      if (item.name === "Skill") {
        const detail = item.detail as Record<string, unknown>;
        skills.push({ type: item.type, name: item.name, status: item.status, detail: { type: detail.type, label: detail.label, icon: detail.icon, text: detail.text } });
      }
    }
    console.log(JSON.stringify({ provider, sampledEntries: items.length, toolShapes: [...shapes.values()], skills }, null, 2));
  }
} catch { console.error("Timeline probe failed; response contents omitted."); process.exitCode = 1; }
finally { await client.close(); }
