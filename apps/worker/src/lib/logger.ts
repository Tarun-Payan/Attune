import { createLogger, createJobLogger, generateRunId, type Logger } from "@attune/logger";
import { getRedisClient } from "@attune/cache";

/** Structured worker logging, identified by service=worker */
export const logger: Logger = createLogger({
  service: "worker",
  redisClient: process.env.NODE_ENV !== "test" ? getRedisClient() : undefined,
});

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

export { createJobLogger, generateRunId };
