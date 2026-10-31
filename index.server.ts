import type { PluginServerContext } from "@getpaseo/plugin/server";
import { settingsReadRpc } from "./shared/rpc";
import { readSettings } from "./server/settings";

export default function contribute(server: PluginServerContext) {
  server.handle(settingsReadRpc, readSettings);
  return () => {};
}
