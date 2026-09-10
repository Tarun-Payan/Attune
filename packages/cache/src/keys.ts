/**
 * Attune Cache & Rate Limit Key Namespace Standard
 * Format: attune:cache:<entity>[:sub-identifiers]
 */
export const CACHE_PREFIX = "attune:cache";

export const CACHE_KEYS = {
  // Aggregate Stats
  ADMIN_STATS: `${CACHE_PREFIX}:stats:dashboard`,

  // Taxonomy
  TOPICS_ALL: `${CACHE_PREFIX}:topics:all`,
  TAGS_ALL: `${CACHE_PREFIX}:tags:all`,
  tagsForTopic: (topicId: string) => `${CACHE_PREFIX}:tags:topic:${topicId}`,

  // User-specific
  userStats: (userId: string) => `${CACHE_PREFIX}:me:stats:${userId}`,
  userFeedFirstPage: (userId: string, topicKey?: string | null) =>
    `${CACHE_PREFIX}:feed:${userId}:first:${topicKey ?? "all"}`,
  userFeedCursor: (userId: string, cursor: string) =>
    `${CACHE_PREFIX}:feed:${userId}:cursor:${cursor}`,
  userFeedPattern: (userId: string) => `${CACHE_PREFIX}:feed:${userId}:*`,

  // Items
  itemDetail: (itemId: string) => `${CACHE_PREFIX}:item:${itemId}`,

  // Rate Limits
  AI_RPM: "ai:ratelimit:rpm",
  AI_RPD: "ai:ratelimit:rpd",
} as const;
