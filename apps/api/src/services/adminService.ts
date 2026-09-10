import type {
  AdminItemsQueryInput,
  CampaignInput,
  SourceCreateInput,
  SourcePatchInput,
  TagCreateInput,
  TagPatchInput,
  TopicCreateInput,
  TopicPatchInput,
} from "@attune/schemas";
import type { PatchSystemSettingsInput, SyncStatus } from "@attune/types";
import { enqueueCampaign, enqueueSync } from "../queues";
import {
  CACHE_KEYS,
  checkRedisHealth,
  del,
  delPattern,
  getOrSet,
  getRedisClient,
} from "@attune/cache";
import { getDashboardMetrics } from "../repository/statsRepository";
import {
  createSource as createSourceRepo,
  deleteSource as deleteSourceRepo,
  findSourceById,
  listSources as listSourcesRepo,
  listSyncRuns as listSyncRunsRepo,
  updateSource as updateSourceRepo,
} from "../repository/sourceRepository";
import {
  dismissItemReports as dismissItemReportsRepo,
  listAdminItems,
  setItemHidden as setItemHiddenRepo,
} from "../repository/itemRepository";
import {
  listUsers as listUsersRepo,
  setUserDisabled as setUserDisabledRepo,
} from "../repository/userRepository";
import {
  createTopic as createTopicRepo,
  deleteTopic as deleteTopicRepo,
  listAdminTopics,
  updateTopic as updateTopicRepo,
} from "../repository/topicRepository";
import {
  createTag as createTagRepo,
  deleteTag as deleteTagRepo,
  listAdminTags as listAdminTagsRepo,
  listTags as listTagsRepo,
  updateTag as updateTagRepo,
} from "../repository/tagRepository";
import {
  getSystemSettings as getSystemSettingsRepo,
  updateSystemSettings as updateSystemSettingsRepo,
} from "../repository/settingsRepository";
import { listCampaignLogs } from "../repository/notificationRepository";
import { ConflictError, NotFoundError } from "../errors";

export async function getDashboardStats() {
  return getOrSet(CACHE_KEYS.ADMIN_STATS, 300, () => getDashboardMetrics());
}

export async function listSources() {
  const sources = await listSourcesRepo();
  return {
    count: sources.length,
    sources,
  };
}

export async function createSource(input: SourceCreateInput) {
  const source = await createSourceRepo(input);
  await del(CACHE_KEYS.ADMIN_STATS);
  return { source };
}

export async function updateSource(id: string, input: SourcePatchInput) {
  const updated = await updateSourceRepo(id, input);
  if (!updated) {
    throw new NotFoundError("Source not found");
  }
  await del(CACHE_KEYS.ADMIN_STATS);
  return { source: updated };
}

export async function deleteSource(id: string) {
  const deleted = await deleteSourceRepo(id);
  if (!deleted) {
    throw new NotFoundError("Source not found");
  }
  await del(CACHE_KEYS.ADMIN_STATS);
  return { deleted: true as const };
}

export async function triggerSourceSync(id: string) {
  const source = await findSourceById(id);
  if (!source) {
    throw new NotFoundError("Source not found");
  }

  const job = await enqueueSync({ sourceId: id });
  await del(CACHE_KEYS.ADMIN_STATS);

  return { queued: true as const, jobId: job.id, source: source.name };
}

export async function listSyncRuns(
  sourceId?: string,
  limit = 20,
  offset = 0,
  status?: SyncStatus,
) {
  const { runs, total } = await listSyncRunsRepo(sourceId, limit, offset, status);
  return {
    count: total,
    runs,
  };
}

export async function listItems(filters: AdminItemsQueryInput) {
  const { items, total } = await listAdminItems(filters);
  return {
    count: total,
    items,
  };
}

export async function setItemHidden(id: string, hidden: boolean) {
  const updated = await setItemHiddenRepo(id, hidden);
  if (!updated) {
    throw new NotFoundError("Item not found");
  }
  await del(CACHE_KEYS.ADMIN_STATS);
  await del(CACHE_KEYS.itemDetail(id));
  return { item: updated };
}

export async function listUsers(query: { q?: string; limit: number; offset: number }) {
  const { users, total } = await listUsersRepo(query);
  return {
    count: total,
    users,
  };
}

export async function setUserDisabled(id: string, disabled: boolean) {
  const updated = await setUserDisabledRepo(id, disabled);
  if (!updated) {
    throw new NotFoundError("User not found");
  }
  return { user: updated };
}

export async function listTopics() {
  const topics = await listAdminTopics();
  return {
    count: topics.length,
    topics,
  };
}

export async function createTopic(input: TopicCreateInput) {
  const created = await createTopicRepo(input);
  if (!created) {
    throw new ConflictError("A topic with this key already exists");
  }
  await del(CACHE_KEYS.TOPICS_ALL);
  return { topic: created };
}

export async function updateTopic(id: string, input: TopicPatchInput) {
  const updated = await updateTopicRepo(id, input);
  if (!updated) {
    throw new NotFoundError("Topic not found");
  }
  await del(CACHE_KEYS.TOPICS_ALL);
  return { topic: updated };
}

export async function deleteTopic(id: string) {
  const deleted = await deleteTopicRepo(id);
  if (!deleted) {
    throw new NotFoundError("Topic not found");
  }
  await del(CACHE_KEYS.TOPICS_ALL);
  return { deleted: true as const };
}

export async function queueCampaign(input: CampaignInput) {
  const job = await enqueueCampaign(input);
  return { queued: true as const, jobId: job.id };
}

export async function listCampaigns(limit = 25, offset = 0) {
  const { sends, total } = await listCampaignLogs(limit, offset);
  return {
    count: total,
    sends,
  };
}

export async function dismissItemReports(id: string) {
  const updated = await dismissItemReportsRepo(id);
  if (!updated) {
    throw new NotFoundError("Item not found");
  }
  return { item: updated };
}

export async function listTags(topicId?: string) {
  const tags = await listTagsRepo(topicId);
  return {
    count: tags.length,
    tags,
  };
}

export async function listAdminTags() {
  const tags = await listAdminTagsRepo();
  return {
    count: tags.length,
    tags,
  };
}

export async function createTag(input: TagCreateInput) {
  const created = await createTagRepo(input);
  if (!created) {
    throw new ConflictError("A tag with this key already exists");
  }
  await del(CACHE_KEYS.TAGS_ALL);
  return { tag: created };
}

export async function updateTag(id: string, input: TagPatchInput) {
  const updated = await updateTagRepo(id, input);
  if (!updated) {
    throw new NotFoundError("Tag not found");
  }
  await del(CACHE_KEYS.TAGS_ALL);
  return { tag: updated };
}

export async function deleteTag(id: string) {
  const deleted = await deleteTagRepo(id);
  if (!deleted) {
    throw new NotFoundError("Tag not found");
  }
  await del(CACHE_KEYS.TAGS_ALL);
  return { deleted: true as const };
}

export async function getSettings() {
  const settings = await getSystemSettingsRepo();
  return { settings };
}

export async function updateSettings(input: PatchSystemSettingsInput) {
  const settings = await updateSystemSettingsRepo(input);
  return { settings };
}

function inferNamespace(key: string): string {
  if (key.startsWith("attune:cache:topics:")) return "topics";
  if (key.startsWith("attune:cache:tags:")) return "tags";
  if (key.startsWith("attune:cache:stats:")) return "stats";
  if (key.startsWith("attune:cache:feed:")) return "feed";
  if (key.startsWith("attune:cache:item:")) return "item";
  if (key.startsWith("attune:cache:me:")) return "user";
  if (key.startsWith("ai:ratelimit:")) return "rateLimit";
  if (key.startsWith("bull:")) return "queues";
  return "other";
}

export async function getCacheOverview() {
  const client = getRedisClient();
  const health = await checkRedisHealth();

  let redisVersion = "unknown";
  let uptimeSec = 0;
  let usedMemoryHuman = "0B";
  let peakMemoryHuman = "0B";
  let connectedClients = 0;

  try {
    const rawInfo = await client.info();
    const parseField = (pattern: RegExp) => rawInfo.match(pattern)?.[1]?.trim() ?? "";

    redisVersion = parseField(/redis_version:([^\r\n]+)/) || "unknown";
    uptimeSec = Number(parseField(/uptime_in_seconds:([^\r\n]+)/) || 0);
    usedMemoryHuman = parseField(/used_memory_human:([^\r\n]+)/) || "0B";
    peakMemoryHuman = parseField(/used_memory_peak_human:([^\r\n]+)/) || "0B";
    connectedClients = Number(parseField(/connected_clients:([^\r\n]+)/) || 0);
  } catch {
    // Graceful degradation
  }

  const namespaceCounts: Record<string, number> = {
    topics: 0,
    tags: 0,
    stats: 0,
    feed: 0,
    item: 0,
    user: 0,
    rateLimit: 0,
    queues: 0,
    other: 0,
  };

  let totalKeys = 0;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(cursor, "COUNT", 200);
      cursor = nextCursor;
      totalKeys += keys.length;
      for (const k of keys) {
        const ns = inferNamespace(k);
        namespaceCounts[ns] = (namespaceCounts[ns] ?? 0) + 1;
      }
    } while (cursor !== "0");
  } catch {
    // ignore
  }

  return {
    status: health.status === "up" ? ("ready" as const) : ("unavailable" as const),
    latencyMs: health.latencyMs ?? 0,
    redisVersion,
    uptimeSec,
    usedMemoryHuman,
    peakMemoryHuman,
    connectedClients,
    totalKeys,
    namespaceCounts,
  };
}

export async function listCacheKeys(prefix?: string, limit = 100) {
  const client = getRedisClient();
  const pattern = prefix ? `${prefix}*` : "*";
  const matchedKeys: string[] = [];

  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      for (const k of keys) {
        matchedKeys.push(k);
        if (matchedKeys.length >= limit) break;
      }
      if (matchedKeys.length >= limit) break;
    } while (cursor !== "0");
  } catch {
    // ignore
  }

  if (matchedKeys.length === 0) {
    return { total: 0, keys: [] };
  }

  const pipeline = client.pipeline();
  for (const k of matchedKeys) {
    pipeline.ttl(k);
    pipeline.type(k);
  }

  const results = await pipeline.exec();
  const keysList = matchedKeys.map((key, i) => {
    const ttlRes = results?.[i * 2];
    const typeRes = results?.[i * 2 + 1];

    const ttl = typeof ttlRes?.[1] === "number" ? ttlRes[1] : -1;
    const type = typeof typeRes?.[1] === "string" ? typeRes[1] : "string";

    return {
      key,
      namespace: inferNamespace(key),
      type,
      ttl,
    };
  });

  return {
    total: keysList.length,
    keys: keysList,
  };
}

export async function getCacheKeyDetail(key: string) {
  const client = getRedisClient();
  const [ttl, type] = await Promise.all([client.ttl(key), client.type(key)]);

  let value: unknown = null;
  try {
    if (type === "string") {
      const raw = await client.get(key);
      if (raw) {
        try {
          value = JSON.parse(raw);
        } catch {
          value = raw;
        }
      }
    } else if (type === "zset") {
      value = await client.zrange(key, 0, 20, "WITHSCORES");
    } else if (type === "hash") {
      value = await client.hgetall(key);
    } else if (type === "list") {
      value = await client.lrange(key, 0, 20);
    } else if (type === "set") {
      value = await client.smembers(key);
    }
  } catch {
    // ignore
  }

  return {
    key,
    namespace: inferNamespace(key),
    type,
    ttl,
    value,
  };
}

export async function deleteCacheKey(key: string) {
  const deleted = await del(key);
  return { deleted, key };
}

export async function clearCacheNamespace(namespace: string, pattern?: string) {
  let targetPattern = "attune:cache:*";

  if (namespace === "topics") targetPattern = "attune:cache:topics:*";
  else if (namespace === "tags") targetPattern = "attune:cache:tags:*";
  else if (namespace === "stats") targetPattern = "attune:cache:stats:*";
  else if (namespace === "feed") targetPattern = "attune:cache:feed:*";
  else if (namespace === "item") targetPattern = "attune:cache:item:*";
  else if (namespace === "custom" && pattern) targetPattern = pattern;

  const deletedCount = await delPattern(targetPattern);
  return {
    cleared: true as const,
    namespace,
    deletedCount,
  };
}
