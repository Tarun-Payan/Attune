import { z } from "zod";
import { DEVICE_PLATFORMS, DEVICE_PROVIDERS, NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES } from "@attune/types";

// ── Notification Request Schemas ───────────────────────────────────────────

export const notificationSettingsSchema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  maxPushPerHour: z.number().int().min(1).max(10).optional(),
});

export const deviceRegistrationSchema = z.object({
  token: z.string().min(20, "Token is too short").max(512, "Token is too long"),
  platform: z.enum(DEVICE_PLATFORMS),
  provider: z.enum(DEVICE_PROVIDERS).default("expo"),
});

export const campaignSchema = z.object({
  title: z.string().min(1, "Title is required").max(120, "Title is too long"),
  body: z.string().min(1, "Body is required").max(500, "Body is too long"),
  channel: z.enum(NOTIFICATION_CHANNELS),
  topicKey: z.string().max(60).optional(),
  userIds: z.array(z.string().uuid()).optional(),
});

export const campaignsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Notification Response Schemas ──────────────────────────────────────────

export const notificationSettingsResponseSchema = z.object({
  settings: z.object({
    userId: z.string(),
    pushEnabled: z.boolean(),
    emailEnabled: z.boolean(),
    maxPushPerHour: z.number(),
  }),
});

export const deviceRegistrationResponseSchema = z.object({
  deviceId: z.string(),
  registered: z.literal(true),
});

export const campaignLogSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  channel: z.enum(NOTIFICATION_CHANNELS),
  status: z.enum(NOTIFICATION_STATUSES),
  error: z.string().nullable(),
  sentAt: z.string(),
});

export const campaignSendsResponseSchema = z.object({
  count: z.number(),
  sends: z.array(campaignLogSchema),
});

export const campaignQueuedResponseSchema = z.object({
  queued: z.literal(true),
  jobId: z.string(),
});

export const inAppNotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  itemId: z.string().nullable().optional(),
  title: z.string(),
  body: z.string(),
  kind: z.string(),
  data: z.record(z.unknown()).nullable().optional(),
  readAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const inAppNotificationsResponseSchema = z.object({
  count: z.number(),
  unreadCount: z.number(),
  notifications: z.array(inAppNotificationSchema),
});

export const inAppNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const markNotificationReadResponseSchema = z.object({
  read: z.literal(true),
});

export const markAllNotificationsReadResponseSchema = z.object({
  markedReadCount: z.number(),
});

// ── Inferred Types ─────────────────────────────────────────────────────────

export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
export type DeviceRegistrationInput = z.infer<typeof deviceRegistrationSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type CampaignsQueryInput = z.infer<typeof campaignsQuerySchema>;
export type CampaignLogDTO = z.infer<typeof campaignLogSchema>;
export type InAppNotificationDTO = z.infer<typeof inAppNotificationSchema>;
export type InAppNotificationsResponseDTO = z.infer<typeof inAppNotificationsResponseSchema>;
export type InAppNotificationsQueryInput = z.infer<typeof inAppNotificationsQuerySchema>;
