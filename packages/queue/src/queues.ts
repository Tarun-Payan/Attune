import { Queue } from "bullmq";
import { connection } from "./connection";

export const ingestQueue = new Queue("ingest", { connection });
export const pipelineQueue = new Queue("pipeline", { connection });
export const systemQueue = new Queue("system", { connection });

export const allQueues = [ingestQueue, pipelineQueue, systemQueue] as const;
