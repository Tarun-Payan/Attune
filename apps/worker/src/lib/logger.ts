import pino from "pino";

/** Structured logging, consistent with the API's Fastify/pino output. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined, // drop pid/hostname noise
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
