import { eq } from "drizzle-orm";
import { db } from "@attune/db/client";
import { systemSettings } from "@attune/db/schema";
import type { PatchSystemSettingsInput, SystemSettings } from "@attune/types";

export const DEFAULT_SETTINGS: SystemSettings = {
  reportAutoHideThreshold: 5,
  explorationRatioPercent: 10,
  minDwellNudgeSeconds: 5,
};

let cachedSettings: { data: SystemSettings; expiresAt: number } | null = null;

export async function getSystemSettings(): Promise<SystemSettings> {
  const now = Date.now();
  if (cachedSettings && cachedSettings.expiresAt > now) {
    return cachedSettings.data;
  }

  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "general"));

    const val = (row?.value as Partial<SystemSettings>) ?? {};
    const settings: SystemSettings = {
      reportAutoHideThreshold: Number(val.reportAutoHideThreshold ?? DEFAULT_SETTINGS.reportAutoHideThreshold),
      explorationRatioPercent: Number(val.explorationRatioPercent ?? DEFAULT_SETTINGS.explorationRatioPercent),
      minDwellNudgeSeconds: Number(val.minDwellNudgeSeconds ?? DEFAULT_SETTINGS.minDwellNudgeSeconds),
    };

    cachedSettings = { data: settings, expiresAt: now + 30_000 };
    return settings;
  } catch (err) {
    console.warn("Failed to query system_settings from database, falling back to DEFAULT_SETTINGS:", err);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSystemSettings(patch: PatchSystemSettingsInput): Promise<SystemSettings> {
  const current = await getSystemSettings();
  const next: SystemSettings = {
    ...current,
    ...patch,
  };

  await db
    .insert(systemSettings)
    .values({
      key: "general",
      value: next,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: next,
        updatedAt: new Date(),
      },
    });

  cachedSettings = { data: next, expiresAt: Date.now() + 30_000 };
  return next;
}
