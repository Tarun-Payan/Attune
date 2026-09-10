import type { NotificationChannel, NotificationKind, NotificationStatus } from "./enums";

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  maxPushPerHour: number;
}

export interface CampaignLog {
  id: string;
  email: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  error: string | null;
  sentAt: string;
}

export interface NotificationLog {
  id: string;
  userId: string;
  itemId?: string | null;
  channel: NotificationChannel;
  kind: NotificationKind;
  status: NotificationStatus;
  error?: string | null;
  sentAt: Date | string;
}

export interface CampaignsResponse {
  count: number;
  sends: CampaignLog[];
}

export interface NotificationSettingsResponse {
  settings: NotificationSettings;
}

export interface InAppNotification {
  id: string;
  userId: string;
  itemId?: string | null;
  title: string;
  body: string;
  kind: string;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

export interface InAppNotificationsResponse {
  count: number;
  unreadCount: number;
  notifications: InAppNotification[];
}

