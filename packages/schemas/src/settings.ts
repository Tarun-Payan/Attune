import { z } from "zod";

export const systemSettingsSchema = z.object({
  reportAutoHideThreshold: z.number().int().min(1).max(100).default(5),
  explorationRatioPercent: z.number().min(0).max(50).default(10),
  minDwellNudgeSeconds: z.number().int().min(1).max(60).default(5),
});

export const patchSystemSettingsSchema = systemSettingsSchema.partial();

export const systemSettingsResponseSchema = z.object({
  settings: systemSettingsSchema,
});

export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;
export type PatchSystemSettingsInput = z.infer<typeof patchSystemSettingsSchema>;
export type SystemSettingsDTO = z.infer<typeof systemSettingsSchema>;
