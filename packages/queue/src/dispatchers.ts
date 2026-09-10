import type { JobsOptions } from "bullmq";
import {
  JOB_NAMES,
  type CampaignJobPayload,
  type NotifyItemsJobPayload,
  type SyncSourceJobPayload,
  type WelcomeEmailJobPayload,
} from "@attune/types";
import {
  syncSourceJobSchema,
  notifyItemsJobSchema,
  welcomeEmailJobSchema,
  campaignJobSchema,
} from "@attune/schemas";
import { ingestQueue, pipelineQueue, systemQueue } from "./queues";
import { DEFAULT_JOB_OPTS, CAMPAIGN_JOB_OPTS, HEARTBEAT_JOB_OPTS } from "./constants";

/**
 * Enqueues a source sync job to the ingest queue.
 */
export async function enqueueSync(payload: SyncSourceJobPayload, opts?: JobsOptions) {
  const parsed = syncSourceJobSchema.parse(payload);
  const mergedOpts: JobsOptions = {
    ...DEFAULT_JOB_OPTS,
    jobId: `manual-${parsed.sourceId}-${Date.now()}`,
    ...opts,
  };
  return ingestQueue.add(JOB_NAMES.SYNC_SOURCE, parsed, mergedOpts);
}

/**
 * Enqueues a transactional welcome email job to the pipeline queue.
 */
export async function enqueueWelcomeEmail(payload: WelcomeEmailJobPayload, opts?: JobsOptions) {
  const parsed = welcomeEmailJobSchema.parse(payload);
  const mergedOpts: JobsOptions = {
    jobId: `welcome-${parsed.userId}`,
    removeOnComplete: 100,
    removeOnFail: 200,
    ...opts,
  };
  return pipelineQueue.add(JOB_NAMES.SEND_WELCOME_EMAIL, parsed, mergedOpts);
}

/**
 * Enqueues an announcement campaign job to the pipeline queue.
 */
export async function enqueueCampaign(payload: CampaignJobPayload, opts?: JobsOptions) {
  const parsed = campaignJobSchema.parse(payload);
  const mergedOpts: JobsOptions = {
    ...CAMPAIGN_JOB_OPTS,
    jobId: `campaign-${Date.now()}`,
    ...opts,
  };
  return pipelineQueue.add(JOB_NAMES.CAMPAIGN, parsed, mergedOpts);
}

/**
 * Enqueues push notification delivery for newly ingested items.
 */
export async function enqueueNotifyItems(payload: NotifyItemsJobPayload, opts?: JobsOptions) {
  const parsed = notifyItemsJobSchema.parse(payload);
  const mergedOpts: JobsOptions = {
    ...DEFAULT_JOB_OPTS,
    ...opts,
  };
  return pipelineQueue.add(JOB_NAMES.NOTIFY_ITEMS, parsed, mergedOpts);
}

/**
 * Enqueues repeatable categorize sweep job.
 */
export async function enqueueCategorizeSweep(opts?: JobsOptions) {
  return pipelineQueue.add(
    JOB_NAMES.CATEGORIZE_SWEEP,
    {},
    {
      ...DEFAULT_JOB_OPTS,
      repeat: { every: 5 * 60_000 },
      jobId: "categorize-sweep",
      ...opts,
    },
  );
}

/**
 * Enqueues repeatable AI summarizer job.
 */
export async function enqueueSummarize(opts?: JobsOptions) {
  return pipelineQueue.add(
    JOB_NAMES.SUMMARIZE,
    {},
    {
      ...DEFAULT_JOB_OPTS,
      repeat: { every: 10 * 60_000 },
      jobId: "summarize",
      ...opts,
    },
  );
}

/**
 * Enqueues repeatable AI clustering job.
 */
export async function enqueueCluster(opts?: JobsOptions) {
  return pipelineQueue.add(
    JOB_NAMES.CLUSTER,
    {},
    {
      ...DEFAULT_JOB_OPTS,
      repeat: { every: 60 * 60_000 },
      jobId: "cluster",
      ...opts,
    },
  );
}

/**
 * Enqueues repeatable system heartbeat job.
 */
export async function enqueueHeartbeat(heartbeatMs = 60_000, opts?: JobsOptions) {
  return systemQueue.add(
    JOB_NAMES.HEARTBEAT,
    {},
    {
      ...HEARTBEAT_JOB_OPTS,
      repeat: { every: heartbeatMs },
      jobId: "heartbeat",
      ...opts,
    },
  );
}
