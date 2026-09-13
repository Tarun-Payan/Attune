import type { Job } from "bullmq";
import { notifyItemsJobSchema } from "@attune/schemas";
import { createJobLogger, logger } from "../lib/logger";
import { processTopicMatches } from "../services";

/**
 * Topic-match pushes (blueprint §11): new items landed in topics users asked
 * to be notified about — but calmly: quiet hours, hourly cap, cooldown.
 */
export async function notifyItemsProcessor(job: Job) {
  const parsed = notifyItemsJobSchema.safeParse(job.data);
  if (!parsed.success) {
    logger.error({ jobId: job.id, errors: parsed.error.issues }, "Invalid notify job payload");
    return { notified: 0 };
  }

  const jobLog = createJobLogger(logger, job, "pipeline");
  jobLog.info({ itemCount: parsed.data.itemIds.length }, "Processing topic notifications for new items");
  return processTopicMatches(parsed.data.itemIds);
}
