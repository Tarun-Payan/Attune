import { getRedisClient } from "./client";

export interface RedisHealthStatus {
  status: "up" | "down";
  latencyMs?: number;
  error?: string;
}

/**
 * Pings the Redis instance and measures round-trip latency.
 */
export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  const start = Date.now();
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    if (pong === "PONG") {
      return {
        status: "up",
        latencyMs: Date.now() - start,
      };
    }
    return {
      status: "down",
      error: `Unexpected ping response: ${pong}`,
    };
  } catch (err) {
    return {
      status: "down",
      error: (err as Error).message,
    };
  }
}
