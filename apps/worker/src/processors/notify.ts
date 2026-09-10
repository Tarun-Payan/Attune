import type { Job } from "bullmq";
import { notifyItemsJobSchema } from "@attune/schemas";
import { childLogger } from "../lib/logger";
import { processTopicMatches } from "../services";

const log = childLogger({ component: "notifyProcessor" });

/**
 * Topic-match pushes (blueprint §11): new items landed in topics users asked
 * to be notified about — but calmly: quiet hours, hourly cap, cooldown.
 */
export async function notifyItemsProcessor(job: Job) {
  const parsed = notifyItemsJobSchema.safeParse(job.data);
  if (!parsed.success) {
    log.error({ errors: parsed.error.issues }, "Invalid notify job payload");
    return { notified: 0 };
  }

  return processTopicMatches(parsed.data.itemIds);
}
