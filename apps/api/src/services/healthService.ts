import type { HealthResponse } from "@attune/types";
import { checkRedisHealth } from "@attune/cache";
import { pingDatabase } from "../repository/healthRepository";

/**
 * Checks connectivity to the database and Redis, and produces service uptime telemetry.
 */
export async function getHealthStatus(): Promise<HealthResponse> {
  const [_, redisHealth] = await Promise.all([
    pingDatabase(),
    checkRedisHealth().catch(() => ({ status: "down" as const })),
  ]);

  return {
    status: "ok",
    service: "attune-api",
    db: "up",
    redis: redisHealth.status,
    uptimeSec: Math.round(process.uptime()),
  };
}
