import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { statusSettingsSchema } from "./settings";

export const settingsOutputSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), settings: statusSettingsSchema, path: z.string() }),
  z.object({ ok: z.literal(false), path: z.string(), reason: z.string() }),
]);

export type SettingsOutput = z.infer<typeof settingsOutputSchema>;

export const settingsReadRpc = defineRpc({
  name: "settings.read",
  input: z.object({}),
  output: settingsOutputSchema,
});
