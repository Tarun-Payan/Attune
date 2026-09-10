import { hasConnector } from "../connectors";
import { ingestQueue, JOB_OPTS, pipelineQueue } from "../queues";
import { findAllSources } from "../repository";

// Per-type sync intervals (blueprint §6 cron table). RSS is staggered naturally
// by BullMQ processing them with concurrency 4.
const INTERVAL_BY_TYPE: Record<string, number> = {
  RSS: 15 * 60_000,
  HACKERNEWS: 30 * 60_000,
  REDDIT: 30 * 60_000,
  GITHUB_TRENDING: 60 * 60_000,
  GITHUB_RELEASES: 60 * 60_000,
  YOUTUBE: 60 * 60_000,
};

export interface ScheduleStats {
  scheduled: number;
  backfilled: number;
  totalSources: number;
}

export async function registerSchedules(): Promise<ScheduleStats> {
  const allSources = await findAllSources();
  const wantedSources = new Set<string>();
  let backfilled = 0;

  for (const source of allSources) {
    const every = INTERVAL_BY_TYPE[source.type];
    if (!every || !hasConnector(source.type) || !source.enabled) continue;
    const jobId = `sync-${source.id}`;
    await ingestQueue.add(
      "sync",
      { sourceId: source.id },
      { ...JOB_OPTS, repeat: { every }, jobId },
    );
    wantedSources.add(jobId);

    // First-run backfill: sources that have never synced get an immediate one-off
    if (!source.lastSyncAt) {
      await ingestQueue.add(
        "sync",
        { sourceId: source.id },
        { ...JOB_OPTS, jobId: `first-${source.id}` },
      );
      backfilled += 1;
    }
  }

  // Remove repeatables for sources that no longer exist / are disabled (e.g. tripped breaker)
  const existing = await ingestQueue.getJobSchedulers();
  for (const s of existing) {
    const id = s.id ?? s.key;
    if (id && !wantedSources.has(id)) {
      await ingestQueue.removeJobScheduler(s.key);
    }
  }

  await pipelineQueue.add(
    "categorize-sweep",
    {},
    { ...JOB_OPTS, repeat: { every: 5 * 60_000 }, jobId: "categorize-sweep" },
  );

  // AI enrichment: summaries every 10 min (budget-capped), clustering hourly
  await pipelineQueue.add(
    "summarize",
    {},
    { ...JOB_OPTS, repeat: { every: 10 * 60_000 }, jobId: "summarize" },
  );
  await pipelineQueue.add(
    "cluster",
    {},
    { ...JOB_OPTS, repeat: { every: 60 * 60_000 }, jobId: "cluster" },
  );

  return { scheduled: wantedSources.size, backfilled, totalSources: allSources.length };
}
