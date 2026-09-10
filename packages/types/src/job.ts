export interface SyncSourceJobPayload {
  sourceId: string;
}

export interface NotifyItemsJobPayload {
  itemIds: string[];
}

export interface WelcomeEmailJobPayload {
  userId: string;
  email: string;
  name?: string;
}

export interface CampaignJobPayload {
  title: string;
  body: string;
  channel: "push" | "email";
  topicKey?: string;
  userIds?: string[];
}

export type HeartbeatJobPayload = Record<string, never>;
export type SweepJobPayload = Record<string, never>;
export type SummarizeJobPayload = Record<string, never>;
export type ClusterJobPayload = Record<string, never>;
