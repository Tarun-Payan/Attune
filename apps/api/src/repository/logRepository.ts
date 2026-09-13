import { getRedisClient } from "@attune/cache";
import { DEFAULT_REDIS_LOG_KEY, getLogBufferMaxCache } from "@attune/logger";

const REDIS_LOG_KEY = process.env.REDIS_LOG_KEY ?? DEFAULT_REDIS_LOG_KEY;

/**
 * Fetches raw serialized log lines from the Redis log buffer.
 */
export async function fetchRecentLogsFromBuffer(limit?: number): Promise<string[]> {
  const redis = getRedisClient();
  const maxToFetch = limit ?? getLogBufferMaxCache();
  return redis.lrange(REDIS_LOG_KEY, 0, maxToFetch - 1);
}

/**
 * Returns total count of log lines currently in the Redis buffer.
 */
export async function getLogBufferCount(): Promise<number> {
  const redis = getRedisClient();
  return redis.llen(REDIS_LOG_KEY);
}

/**
 * Deletes all logs from the Redis buffer.
 */
export async function clearLogBuffer(): Promise<number> {
  const redis = getRedisClient();
  const count = await redis.llen(REDIS_LOG_KEY);
  await redis.del(REDIS_LOG_KEY);
  return count;
}
