import type { Job } from "bullmq";
import { campaignJobSchema } from "@attune/schemas";
import { createJobLogger, logger } from "../lib/logger";
import { executeCampaign } from "../services";

/** Announcement campaigns (blueprint §12): push or email a topic segment (or everyone). */
export async function campaignProcessor(job: Job) {
  const parsed = campaignJobSchema.safeParse(job.data);
  if (!parsed.success) {
    logger.error({ jobId: job.id, errors: parsed.error.issues }, "Invalid campaign job payload");
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const jobLog = createJobLogger(logger, job, "pipeline");
  jobLog.info({ channel: parsed.data.channel, title: parsed.data.title }, "Executing announcement campaign");
  return executeCampaign(parsed.data);
}
