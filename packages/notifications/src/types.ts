import type { NotificationKind } from "@attune/types";

export interface InAppNotificationInput {
  userId: string;
  title: string;
  body: string;
  kind?: NotificationKind | string;
  itemId?: string | null;
  data?: Record<string, unknown> | null;
}

export interface TechUpdatePayload {
  title: string;
  topicName?: string;
  itemId?: string;
}

export interface CampaignPayload {
  title: string;
  body: string;
  itemId?: string;
  data?: Record<string, unknown>;
}
