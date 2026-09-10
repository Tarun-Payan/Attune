import type { Job } from "bullmq";
import { campaignSchema } from "@attune/schemas";
import { childLogger } from "../lib/logger";
import { executeCampaign } from "../services";

const log = childLogger({ component: "campaignProcessor" });

/** Announcement campaigns (blueprint §12): push or email a topic segment (or everyone). */
export async function campaignProcessor(job: Job) {
  const parsed = campaignSchema.safeParse(job.data);
  if (!parsed.success) {
    log.error({ errors: parsed.error.issues }, "Invalid campaign job payload");
    return { sent: 0, failed: 0, skipped: 0 };
  }

  return executeCampaign(parsed.data);
}
