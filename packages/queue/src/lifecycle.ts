import { allQueues } from "./queues";

/**
 * Closes all centralized BullMQ queue instances.
 * Use during graceful shutdown in API and Worker processes.
 */
export async function closeAllQueues(): Promise<void> {
  await Promise.all(allQueues.map((q) => q.close()));
}
