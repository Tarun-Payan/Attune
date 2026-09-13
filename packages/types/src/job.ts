export interface JobContext {
  requestId?: string;
  runId?: string;
  userId?: string;
}

export interface BaseJobPayload {
  context?: JobContext;
}

export interface SyncSourceJobPayload extends BaseJobPayload {
  sourceId: string;
}

export interface NotifyItemsJobPayload extends BaseJobPayload {
  itemIds: string[];
}

export interface WelcomeEmailJobPayload extends BaseJobPayload {
  userId: string;
  email: string;
  name?: string;
}

export interface CampaignJobPayload extends BaseJobPayload {
  title: string;
  body: string;
  channel: "push" | "email";
  topicKey?: string;
  userIds?: string[];
}

export interface HeartbeatJobPayload extends BaseJobPayload {}
export interface SweepJobPayload extends BaseJobPayload {}
export interface SummarizeJobPayload extends BaseJobPayload {}
export interface ClusterJobPayload extends BaseJobPayload {}
