import "./env";
import { Worker } from "bullmq";
import { closeRedisClient } from "@attune/cache";
import { connection, ingestQueue, pipelineQueue, systemQueue, closeAllQueues } from "./queues";
import {
  campaignProcessor,
  categorizeSweepProcessor,
  clusterProcessor,
  ingestProcessor,
  notifyItemsProcessor,
  summarizeProcessor,
  welcomeEmailProcessor,
} from "./processors";
import { registerSchedules } from "./services/schedulerService";
import { childLogger } from "./lib/logger";

const log = childLogger({ component: "worker" });

// ── Queue: system — heartbeat proving scheduler + Redis work ──────────────
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS ?? 60_000);
await systemQueue.add(
  "heartbeat",
  {},
  { repeat: { every: HEARTBEAT_MS }, jobId: "heartbeat", removeOnComplete: 100, removeOnFail: 500 },
);

// ── Queue: ingest — per-source sync jobs (cron) + manual/admin triggers ───
const stats = await registerSchedules();

const ingestWorker = new Worker("ingest", ingestProcessor, { connection, concurrency: 4 });
ingestWorker.on("completed", (job, result) => {
  if (job.name === "sync") log.info(result, "sync completed");
});
ingestWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err: err.message }, "ingest job failed");
});

// ── Queue: pipeline — post-processing (sweeper, notify, welcome, campaign) ─
const pipelineWorker = new Worker(
  "pipeline",
  async (job) => {
    switch (job.name) {
      case "categorize-sweep":
        return categorizeSweepProcessor();
      case "notify-items":
        return notifyItemsProcessor(job);
      case "send-welcome-email":
        return welcomeEmailProcessor(job);
      case "campaign":
        return campaignProcessor(job);
      case "summarize":
        return summarizeProcessor();
      case "cluster":
        return clusterProcessor();
      default:
        log.warn({ jobName: job.name }, "unknown pipeline job");
        return undefined;
    }
  },
  { connection, concurrency: 2 },
);
pipelineWorker.on("completed", (job, result) => {
  const r = result as { tagged?: number; notified?: number; sent?: number } | undefined;
  if (r && ((r.tagged ?? 0) > 0 || (r.notified ?? 0) > 0 || (r.sent ?? 0) > 0)) {
    log.info(result, `${job.name} completed`);
  }
});
pipelineWorker.on("failed", (job, err) => {
  log.error({ jobName: job?.name, jobId: job?.id, err: err.message }, "pipeline job failed");
});

// ── Queue: system — worker ─────────────────────────────────────────────────
const systemWorker = new Worker(
  "system",
  async (job) => {
    if (job.name === "heartbeat") {
      log.info("heartbeat (queues: ingest, pipeline, system)");
    }
  },
  { connection },
);

log.info(
  { ...stats, heartbeatMs: HEARTBEAT_MS },
  "worker started — sources scheduled, categorize sweep every 5min",
);

// ── Graceful shutdown ──────────────────────────────────────────────────────
async function shutdown() {
  log.info("shutting down");
  await Promise.all([ingestWorker.close(), pipelineWorker.close(), systemWorker.close()]);
  await closeAllQueues();
  await closeRedisClient();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
