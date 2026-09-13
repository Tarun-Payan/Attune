import type { Logger as PinoLogger } from "pino";

export type ServiceName = "api" | "worker" | "admin" | (string & {});

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  service?: ServiceName;
  environment?: string;
  requestId?: string;
  jobId?: string | number;
  jobName?: string;
  runId?: string;
  userId?: string;
  component?: string;
  queue?: string;
  [key: string]: unknown;
}

export interface CreateLoggerOptions {
  service: ServiceName;
  environment?: string;
  level?: LogLevel | string;
  component?: string;
  base?: Record<string, unknown>;
}

export type Logger = PinoLogger;
