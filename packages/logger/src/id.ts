import { randomUUID } from "node:crypto";

/**
 * Generates a request ID for HTTP request tracking (e.g., req_3fa85f64...).
 */
export function generateRequestId(): string {
  return `req_${randomUUID()}`;
}

/**
 * Generates a run ID for independent background operations (e.g., run_7b92ac18...).
 */
export function generateRunId(): string {
  return `run_${randomUUID()}`;
}
