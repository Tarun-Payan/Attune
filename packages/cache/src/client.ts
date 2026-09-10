import Redis, { type RedisOptions } from "ioredis";

let instance: Redis | null = null;
let isClosing = false;

export interface RedisClientConfig {
  url?: string;
  options?: RedisOptions;
}

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

/**
 * Returns a shared, resilient Redis singleton instance.
 */
export function getRedisClient(config?: RedisClientConfig): Redis {
  if (instance && !isClosing) {
    return instance;
  }

  isClosing = false;
  const url = config?.url ?? getRedisUrl();

  const options: RedisOptions = {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      // Exponential backoff capped at 3 seconds
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    ...config?.options,
  };

  instance = new Redis(url, options);

  instance.on("error", (err) => {
    // Avoid unhandled crashes; consumers can check client status
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[Redis] Connection error: ${err.message}`);
    }
  });

  return instance;
}

/**
 * Checks whether the Redis client is currently in ready state.
 */
export function isRedisReady(): boolean {
  return instance?.status === "ready";
}

/**
 * Gracefully disconnects the Redis singleton.
 */
export async function closeRedisClient(): Promise<void> {
  if (!instance) return;
  isClosing = true;
  try {
    if (instance.status === "ready" || instance.status === "connecting") {
      await instance.quit();
    } else {
      instance.disconnect();
    }
  } catch {
    instance.disconnect();
  } finally {
    instance = null;
    isClosing = false;
  }
}

/**
 * Testing helper to reset internal singleton.
 */
export function _resetRedisClientForTesting(): void {
  if (instance) {
    try {
      instance.disconnect();
    } catch {
      // ignore
    }
  }
  instance = null;
  isClosing = false;
}
