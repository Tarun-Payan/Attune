import type { JobsOptions } from "bullmq";

export const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 15_000 },
  removeOnComplete: 200,
  removeOnFail: 500,
};

export const CAMPAIGN_JOB_OPTS: JobsOptions = {
  attempts: 2,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};

export const HEARTBEAT_JOB_OPTS: JobsOptions = {
  removeOnComplete: 100,
  removeOnFail: 500,
};
