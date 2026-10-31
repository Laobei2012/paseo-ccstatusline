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

export const factsOutputSchema = z.object({
  branch: z.string().nullable(),
  memory: z.object({ used: z.number().nonnegative(), total: z.number().positive() }).nullable(),
  outputStyle: z.string().nullable(),
});

export type FactsOutput = z.infer<typeof factsOutputSchema>;

export const factsReadRpc = defineRpc({
  name: "facts.read",
  input: z.object({ cwd: z.string(), provider: z.string() }),
  output: factsOutputSchema,
});
