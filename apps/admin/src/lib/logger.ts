import { createLogger, type Logger } from "@attune/logger";

/**
 * Structured server-side logger for the Next.js Admin application.
 * Identifies logs with service="admin" and current environment.
 */
export const logger: Logger = createLogger({
  service: "admin",
});

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
