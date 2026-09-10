import type { Tag, Topic } from "@attune/types";
import { CACHE_KEYS, getOrSet } from "@attune/cache";
import { listTopics as listTopicsRepo } from "../repository/topicRepository";
import { listTags as listTagsRepo } from "../repository/tagRepository";

/**
 * Returns all active topics (cached for 1 hour).
 */
export async function listTopics(): Promise<{ count: number; topics: Topic[] }> {
  return getOrSet(CACHE_KEYS.TOPICS_ALL, 3600, async () => {
    const topics = await listTopicsRepo();
    return {
      count: topics.length,
      topics,
    };
  });
}

/**
 * Returns all active tags, optionally filtered by topic ID (cached for 1 hour).
 */
export async function listTags(topicId?: string): Promise<{ count: number; tags: Tag[] }> {
  const cacheKey = topicId ? CACHE_KEYS.tagsForTopic(topicId) : CACHE_KEYS.TAGS_ALL;
  return getOrSet(cacheKey, 3600, async () => {
    const tags = await listTagsRepo(topicId);
    return {
      count: tags.length,
      tags,
    };
  });
}
