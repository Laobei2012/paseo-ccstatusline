import type { PluginServerContext } from "@getpaseo/plugin/server";
import { factsReadRpc, settingsReadRpc } from "./shared/rpc";
import { readFacts } from "./server/facts";
import { readSettings } from "./server/settings";

export default function contribute(server: PluginServerContext) {
  server.handle(settingsReadRpc, readSettings);
  server.handle(factsReadRpc, readFacts);
  return () => {};
}
