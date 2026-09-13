import type { Job } from "bullmq";
import { createJobLogger, generateRunId, logger } from "../lib/logger";
import { clusterStories, generateSummaries } from "../services";

/**
 * AI summaries (blueprint §6): every 10 minutes, summarize the hottest
 * recent items that don't have one yet — hard-capped by a daily budget.
 */
export async function summarizeProcessor(job?: Job) {
  const runId = job?.data?.context?.runId ?? generateRunId();
  const log = (job ? createJobLogger(logger, job, "pipeline") : logger).child({
    runId,
    component: "enrichProcessor",
  });

  log.info({ runId }, "Starting AI summaries processor");
  const result = await generateSummaries();
  log.info({ runId, ...result }, "AI summaries processor completed");
  return result;
}

/**
 * Story clustering (blueprint §6 step 2): group near-duplicate titles from
 * different sources into one cluster so the feed can say "reported by N".
 */
export async function clusterProcessor(job?: Job) {
  const runId = job?.data?.context?.runId ?? generateRunId();
  const log = (job ? createJobLogger(logger, job, "pipeline") : logger).child({
    runId,
    component: "enrichProcessor",
  });

  log.info({ runId }, "Starting story clustering processor");
  const result = await clusterStories();
  log.info({ runId, ...result }, "Story clustering processor completed");
  return result;
}
