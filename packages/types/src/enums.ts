// ── Single Source of Truth Enums & Constants ─────────────────────────────────

export const USER_ROLES = ["USER", "EDITOR", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SOURCE_TYPES = [
  "RSS",
  "GITHUB_TRENDING",
  "GITHUB_RELEASES",
  "HACKERNEWS",
  "REDDIT",
  "YOUTUBE",
  "DEVTO",
  "PRODUCTHUNT",
  "BLUESKY",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const INTERACTION_TYPES = [
  "VIEW",
  "LIKE",
  "DISLIKE",
  "SAVE",
  "HIDE",
  "REPORT",
  "OPEN_LINK",
  "SHARE",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const REPORT_REASONS = [
  "SPAM",
  "MISLEADING",
  "OFFENSIVE",
  "DUPLICATE",
  "OTHER",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const OAUTH_PROVIDERS = ["GOOGLE", "GITHUB"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const NOTIFICATION_CHANNELS = ["push", "email"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_KINDS = [
  "topic_match",
  "welcome",
  "campaign",
  "system",
  "security",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_STATUSES = [
  "sent",
  "failed",
  "throttled",
  "skipped",
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const DEVICE_PLATFORMS = ["android", "ios"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const DEVICE_PROVIDERS = ["fcm", "expo"] as const;
export type DeviceProvider = (typeof DEVICE_PROVIDERS)[number];

export const SYNC_STATUSES = ["ok", "error"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const QUEUE_NAMES = ["ingest", "pipeline", "system"] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

export const JOB_NAMES = {
  // Ingest Queue
  SYNC_SOURCE: "sync",
  // Pipeline Queue
  CATEGORIZE_SWEEP: "categorize-sweep",
  NOTIFY_ITEMS: "notify-items",
  SEND_WELCOME_EMAIL: "send-welcome-email",
  CAMPAIGN: "campaign",
  SUMMARIZE: "summarize",
  CLUSTER: "cluster",
  // System Queue
  HEARTBEAT: "heartbeat",
} as const;
export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export const ADMIN_FEATURES = [
  "dashboard",
  "sources",
  "topics",
  "content",
  "users",
  "campaigns",
  "settings",
  "jobs",
  "roles",
  "cache",
] as const;
export type AdminFeature = (typeof ADMIN_FEATURES)[number];

export const ADMIN_ACTIONS = ["read", "create", "update", "write"] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

