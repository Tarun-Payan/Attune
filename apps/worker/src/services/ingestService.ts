import { connectors } from "../connectors";
import type { NormalizedItem } from "../connectors/types";
import { categorize, extractTags } from "../lib/categorize";
import { childLogger } from "../lib/logger";
import { hashUrl, truncate } from "../lib/normalize";
import { pipelineQueue, JOB_OPTS } from "../queues";
import {
  batchInsertItems,
  batchLinkItemTags,
  batchLinkItemTopics,
  disableSource,
  findSourceById,
  getRecentSyncRunStatuses,
  getTagIdByKeyMap,
  getTopicIdByKeyMap,
  recordSyncRun,
  updateSourceLastSync,
} from "../repository";

const log = childLogger({ component: "ingestService" });
const BREAKER_THRESHOLD = 10;

export interface IngestResult {
  sourceId: string;
  skipped?: string;
  found?: number;
  added?: number;
}

export async function syncSource(sourceId: string): Promise<IngestResult> {
  const startedAt = new Date();

  const source = await findSourceById(sourceId);
  if (!source) return { sourceId, skipped: "source not found" };
  if (!source.enabled) return { sourceId, skipped: "source disabled" };

  const connector = connectors[source.type];
  if (!connector) return { sourceId, skipped: `no connector for ${source.type}` };

  let normalized: NormalizedItem[];
  try {
    normalized = await connector.fetch(source.config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finalizeRun(sourceId, startedAt, "error", 0, 0, message);
    await tripBreakerIfStuck(sourceId);
    throw err; // let BullMQ apply its retry policy
  }

  // Dedupe within the batch by url hash
  const byHash = new Map<string, NormalizedItem>();
  for (const n of normalized) {
    try {
      byHash.set(hashUrl(n.url), n);
    } catch {
      // skip items with invalid URLs
    }
  }

  const rows = [...byHash.entries()].map(([urlHash, n]) => ({
    sourceId,
    externalId: truncate(n.externalId, 300),
    url: truncate(n.url, 2000),
    urlHash,
    title: truncate(n.title, 500),
    content: n.content,
    author: n.author ? truncate(n.author, 200) : null,
    imageUrl: n.imageUrl ?? null,
    metrics: n.metrics ?? {},
    publishedAt: n.publishedAt,
  }));

  const inserted = await batchInsertItems(rows);

  // Categorize only the rows that are actually new
  if (inserted.length > 0) {
    const topicIdByKey = await getTopicIdByKeyMap();
    const tagIdByKey = await getTagIdByKeyMap();
    const topicLinks: { itemId: string; topicId: string; confidence: number; method: string }[] = [];
    const tagLinks: { itemId: string; tagId: string }[] = [];

    for (const it of inserted) {
      const src = byHash.get(it.urlHash);
      const text = `${it.title} ${it.content}`;
      const matches = categorize(text, src?.topicHints ?? []);
      for (const m of matches) {
        const topicId = topicIdByKey.get(m.topicKey);
        if (topicId) topicLinks.push({ itemId: it.id, topicId, confidence: m.confidence, method: "rule" });
      }

      const tags = extractTags(text);
      for (const tagKey of tags) {
        const tagId = tagIdByKey.get(tagKey);
        if (tagId) tagLinks.push({ itemId: it.id, tagId });
      }
    }

    if (topicLinks.length > 0) {
      await batchLinkItemTopics(topicLinks);
    }
    if (tagLinks.length > 0) {
      await batchLinkItemTags(tagLinks);
    }
  }

  // Fan out: newly inserted items become push candidates (blueprint §11)
  if (inserted.length > 0) {
    await pipelineQueue.add(
      "notify-items",
      { itemIds: inserted.map((i) => i.id) },
      { ...JOB_OPTS, jobId: undefined },
    );
  }

  await finalizeRun(sourceId, startedAt, "ok", normalized.length, inserted.length, null);
  return { sourceId, found: normalized.length, added: inserted.length };
}

async function finalizeRun(
  sourceId: string,
  startedAt: Date,
  status: "ok" | "error",
  itemsFound: number,
  itemsNew: number,
  error: string | null,
) {
  const finishedAt = new Date();
  await recordSyncRun({
    sourceId,
    status,
    itemsFound,
    itemsNew,
    error: error ? truncate(error, 2000) : null,
    startedAt,
    finishedAt,
  });
  await updateSourceLastSync(sourceId, finishedAt);
}

/** Circuit breaker: 10 consecutive failed runs → disable the source (blueprint §6). */
async function tripBreakerIfStuck(sourceId: string) {
  const recent = await getRecentSyncRunStatuses(sourceId, BREAKER_THRESHOLD);
  if (recent.length === BREAKER_THRESHOLD && recent.every((r) => r.status === "error")) {
    await disableSource(sourceId);
    log.warn(
      { sourceId },
      `CIRCUIT BREAKER: source disabled after ${BREAKER_THRESHOLD} consecutive failures`,
    );
  }
}
