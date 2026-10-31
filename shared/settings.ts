import { z } from "zod";

export const widgetConfigSchema = z.object({
  id: z.string(),
  type: z.string().min(1),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  rawValue: z.boolean().optional(),
});

export const statusSettingsSchema = z.object({
  lines: z.array(z.array(widgetConfigSchema)),
  colorLevel: z.number().int().min(0).max(3).default(2),
  globalBold: z.boolean().default(false),
  powerline: z.object({
    enabled: z.boolean().default(false),
    theme: z.string().optional(),
    continueThemeAcrossLines: z.boolean().default(false),
  }).default({ enabled: false, continueThemeAcrossLines: false }),
});

export type WidgetConfig = z.infer<typeof widgetConfigSchema>;
export type StatusSettings = z.infer<typeof statusSettingsSchema>;

export class SettingsError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SettingsError";
  }
}

// Validate the layout separately so one bad widget cannot discard its neighbors.
const rawSettingsSchema = statusSettingsSchema.extend({ lines: z.array(z.array(z.unknown())) });

export function parseSettings(raw: unknown): StatusSettings {
  const result = rawSettingsSchema.safeParse(raw);
  if (!result.success) {
    const path = result.error.issues[0]?.path.join(".") || "root";
    throw new SettingsError(`Invalid settings structure at ${path}.`);
  }
  return {
    ...result.data,
    lines: result.data.lines.map((line, lineIndex) => line.flatMap((entry, widgetIndex) => {
      const widget = widgetConfigSchema.extend({ id: z.string().default(`${lineIndex}:${widgetIndex}`) }).safeParse(entry);
      return widget.success ? [widget.data] : [];
    })),
  };
}
