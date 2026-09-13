import { Writable } from "node:stream";

export interface RedisLogClient {
  pipeline: () => any;
  status?: string;
}

export interface RedisLogBufferOptions {
  redisClient?: RedisLogClient;
  maxCache?: number;
  redisKey?: string;
}

export const DEFAULT_REDIS_LOG_KEY = "attune:logs:recent";

/**
 * Resolves the maximum log buffer capacity from the MAX_LOG_CACHE environment variable.
 */
export function getLogBufferMaxCache(explicit?: number): number {
  if (typeof explicit === "number" && explicit > 0) {
    return explicit;
  }
  const raw = process.env.MAX_LOG_CACHE;
  
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 2000;
}

/**
 * Creates a non-blocking Writable stream that buffers JSON logs in a capped Redis list.
 */
export function createRedisLogStream(
  redis: RedisLogClient,
  options?: { maxCache?: number; redisKey?: string },
): Writable {
  const maxCache = getLogBufferMaxCache(options?.maxCache);
  const redisKey = options?.redisKey ?? process.env.REDIS_LOG_KEY ?? DEFAULT_REDIS_LOG_KEY;

  return new Writable({
    write(chunk, _encoding, callback) {
      callback(); // Never delay stdout or application execution
      try {
        if (redis.status && redis.status !== "ready") {
          return;
        }
        const line = chunk.toString().trim();
        if (!line) return;

        // Parse line to inspect log level
        let level = 30;
        try {
          const parsed = JSON.parse(line);
          if (typeof parsed.level === "number") {
            level = parsed.level;
          } else if (typeof parsed.level === "string") {
            const lvlStr = parsed.level.toLowerCase();
            if (lvlStr === "info") level = 30;
            else if (lvlStr === "warn" || lvlStr === "warning") level = 40;
            else if (lvlStr === "error" || lvlStr === "fatal") level = 50;
            else if (lvlStr === "debug" || lvlStr === "trace") level = 20;
          }
        } catch {
          // Non-JSON lines are excluded from Redis buffer
          return;
        }

        // Only buffer error (>= 50), warning (40), and debug (<= 20) in Redis.
        // Routine info logs (level === 30) are excluded from the Redis buffer to prevent memory flooding.
        if (level === 30) {
          return;
        }

        redis
          .pipeline()
          .lpush(redisKey, line)

          .ltrim(redisKey, 0, maxCache - 1)
          .exec()
          .catch(() => {});
      } catch {
        // Silently swallow Redis transmission errors to protect app stability
      }
    },
  });
}
