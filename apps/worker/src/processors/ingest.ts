import type { Job } from "bullmq";
import { syncSourceJobSchema } from "@attune/schemas";
import { childLogger } from "../lib/logger";
import { syncSource } from "../services";

const log = childLogger({ component: "ingestProcessor" });

export async function ingestProcessor(job: Job) {
  const parsed = syncSourceJobSchema.safeParse(job.data);
  if (!parsed.success) {
    log.error({ errors: parsed.error.issues }, "Invalid ingest job payload");
    return { skipped: "invalid job payload" };
  }

  return syncSource(parsed.data.sourceId);
}
