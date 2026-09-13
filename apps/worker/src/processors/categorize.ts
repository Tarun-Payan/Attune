import type { Job } from "bullmq";
import { createJobLogger, generateRunId, logger } from "../lib/logger";
import { sweepCategorization } from "../services";

/**
 * Processor for periodic categorization sweeps.
 * Examines newly ingested orphan items and assigns topics/tags via rule matching or AI.
 */
export async function categorizeSweepProcessor(job?: Job) {
  const runId = job?.data?.context?.runId ?? generateRunId();
  const log = (job ? createJobLogger(logger, job, "pipeline") : logger).child({
    runId,
    component: "categorizeProcessor",
  });

  log.info({ runId }, "Starting scheduled categorization sweep");
  const result = await sweepCategorization();
  log.info({ runId, ...result }, "Categorization sweep finished");
  return result;
}
