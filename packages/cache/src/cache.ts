import { getRedisClient } from "./client";

/**
 * Retrieves a typed JSON value from Redis by key.
 * Returns null on cache miss or connection error.
 */
export async function get<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[Cache] GET error for key "${key}": ${(err as Error).message}`);
    }
    return null;
  }
}

/**
 * Stores a typed value in Redis serialized as JSON with optional TTL.
 */
export async function set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(key, serialized, "EX", ttlSeconds);
    } else {
      await client.set(key, serialized);
    }
    return true;
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[Cache] SET error for key "${key}": ${(err as Error).message}`);
    }
    return false;
  }
}

/**
 * Deletes a single key from Redis.
 */
export async function del(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    const res = await client.del(key);
    return res > 0;
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[Cache] DEL error for key "${key}": ${(err as Error).message}`);
    }
    return false;
  }
}

/**
 * Deletes all keys matching a pattern using non-blocking SCAN.
 * Safe for production (avoids blocking KEYS *).
 */
export async function delPattern(pattern: string): Promise<number> {
  try {
    const client = getRedisClient();
    let cursor = "0";
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        const deleted = await client.del(...keys);
        deletedCount += deleted;
      }
    } while (cursor !== "0");

    return deletedCount;
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[Cache] delPattern error for pattern "${pattern}": ${(err as Error).message}`);
    }
    return 0;
  }
}

/**
 * Cache-Aside helper: fetches from cache, or evaluates fetcher, caches result, and returns.
 * If Redis is unavailable or errors, transparently executes and returns the fetcher output.
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const fresh = await fetcher();
  if (fresh !== undefined && fresh !== null) {
    // Write-through to cache asynchronously
    set(key, fresh, ttlSeconds).catch(() => {});
  }

  return fresh;
}
