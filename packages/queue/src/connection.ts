import type { ConnectionOptions } from "bullmq";

export function getBullMQRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

export const connection: ConnectionOptions = {
  url: getBullMQRedisUrl(),
  // BullMQ requires maxRetriesPerRequest: null for its blocking connections
  maxRetriesPerRequest: null,
};
