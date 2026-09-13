import pino from "pino";
import type { CreateLoggerOptions, Logger } from "./types";
import { DEFAULT_REDACT_PATHS, REDACT_CENSOR } from "./redact";
import { createRedisLogStream, type RedisLogClient } from "./buffer";

export interface ExtendedCreateLoggerOptions extends CreateLoggerOptions {
  redisClient?: RedisLogClient;
  maxCache?: number;
  redisKey?: string;
}

/**
 * Creates a structured Pino logger configured for stdout JSON logging on Railway,
 * optionally streaming to a capped Redis buffer.
 */
export function createLogger(options: ExtendedCreateLoggerOptions): Logger {
  const environment = options.environment ?? process.env.NODE_ENV ?? "development";
  const isProduction = environment === "production";
  const level =
    options.level ??
    process.env.LOG_LEVEL ??
    (isProduction ? "info" : "debug");

  const base: Record<string, unknown> = {
    service: options.service,
    environment,
  };

  if (options.component) {
    base.component = options.component;
  }

  if (options.base) {
    Object.assign(base, options.base);
  }

  const pinoOptions: pino.LoggerOptions = {
    level,
    base,
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
    redact: {
      paths: DEFAULT_REDACT_PATHS,
      censor: REDACT_CENSOR,
    },
  };

  if (options.redisClient) {
    const redisStream = createRedisLogStream(options.redisClient, {
      maxCache: options.maxCache,
      redisKey: options.redisKey,
    });

    return pino(
      pinoOptions,
      pino.multistream([
        { stream: process.stdout },
        { stream: redisStream },
      ]),
    );
  }

  return pino(pinoOptions);
}

/**
 * Helper to derive a child logger for a BullMQ job with correlation bindings.
 */
export function createJobLogger(
  logger: Logger,
  job: {
    id?: string | number;
    name?: string;
    data?: {
      context?: {
        requestId?: string;
        runId?: string;
        userId?: string;
      };
      [key: string]: unknown;
    };
  },
  queueName?: string,
): Logger {
  const context = job.data?.context;
  const bindings: Record<string, unknown> = {
    jobId: job.id,
    jobName: job.name,
  };

  if (queueName) {
    bindings.queue = queueName;
  }
  if (context?.requestId) {
    bindings.requestId = context.requestId;
  }
  if (context?.runId) {
    bindings.runId = context.runId;
  }
  if (context?.userId) {
    bindings.userId = context.userId;
  }

  return logger.child(bindings);
}
