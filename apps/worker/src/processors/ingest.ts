import type { Job } from "bullmq";
import { syncSourceJobSchema } from "@attune/schemas";
import { createJobLogger, generateRunId, logger } from "../lib/logger";
import { syncSource } from "../services";

export async function ingestProcessor(job: Job) {
  const parsed = syncSourceJobSchema.safeParse(job.data);
  if (!parsed.success) {
    logger.error({ jobId: job.id, errors: parsed.error.issues }, "Invalid ingest job payload");
    return { skipped: "invalid job payload" };
  }

  const requestId = parsed.data.context?.requestId;
  const runId = parsed.data.context?.runId ?? (requestId ? undefined : generateRunId());

  const jobLog = createJobLogger(
    logger,
    {
      id: job.id,
      name: job.name,
      data: {
        context: {
          ...(requestId ? { requestId } : {}),
          ...(runId ? { runId } : {}),
        },
      },
    },
    "ingest",
  );

  return syncSource(parsed.data.sourceId, { runId, requestId, log: jobLog, jobId: String(job.id) });
}
