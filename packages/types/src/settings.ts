export interface SystemSettings {
  reportAutoHideThreshold: number;
  explorationRatioPercent: number;
  minDwellNudgeSeconds: number;
}

export type PatchSystemSettingsInput = Partial<SystemSettings>;

export interface SystemSettingsResponse {
  settings: SystemSettings;
}
