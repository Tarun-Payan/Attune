import pino from "pino";
import { DEFAULT_REDACT_PATHS, REDACT_CENSOR } from "./redact";
import { generateRequestId } from "./id";
import { createRedisLogStream, type RedisLogClient } from "./buffer";

export interface FastifyLoggerConfig {
  logger: {
    level: string;
    base: {
      service: string;
      environment: string;
    };
    serializers: Record<string, (val: any) => unknown>;
    redact: {
      paths: string[];
      censor: string;
    };
    stream?: any;
  };
  genReqId: (req: { headers: Record<string, unknown> }) => string;
  requestIdLogLabel: string;
  requestIdHeader: string;
  disableRequestLogging?: boolean;
}


export interface FastifyLoggerOptions {
  redisClient?: RedisLogClient;
  maxCache?: number;
  redisKey?: string;
}

/**
 * Returns Fastify server options configured for structured JSON logging,
 * standard request ID generation, automatic header/body redaction,
 * and optional Redis log streaming.
 */
export function getFastifyLoggerConfig(
  service: string = "api",
  options?: FastifyLoggerOptions,
): FastifyLoggerConfig {
  const environment = process.env.NODE_ENV ?? "development";
  const isProduction = environment === "production";
  const level = process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug");

  const baseConfig: FastifyLoggerConfig = {
    logger: {
      level,
      base: {
        service,
        environment,
      },
      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
        req(req: { method: string; url: string; hostname?: string; ip?: string }) {
          return {
            method: req.method,
            url: req.url,
            hostname: req.hostname,
            remoteAddress: req.ip,
          };
        },
        res(res: { statusCode: number }) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
      redact: {
        paths: DEFAULT_REDACT_PATHS,
        censor: REDACT_CENSOR,
      },
    },
    genReqId: (req: { headers: Record<string, unknown> }) => {
      const incoming = req.headers["x-request-id"];
      if (typeof incoming === "string" && incoming.trim().length > 0) {
        return incoming.trim();
      }
      return generateRequestId();
    },
    requestIdLogLabel: "requestId",
    requestIdHeader: "x-request-id",
    disableRequestLogging: true,
  };

  if (options?.redisClient) {
    const redisStream = createRedisLogStream(options.redisClient, {
      maxCache: options.maxCache,
      redisKey: options.redisKey,
    });

    baseConfig.logger.stream = pino.multistream([
      { stream: process.stdout },
      { stream: redisStream },
    ]);
  }

  return baseConfig;
}

/**
 * Emits exactly ONE structured log entry upon HTTP response completion,
 * dynamically categorizing by status code (2xx/3xx -> INFO, 4xx -> WARN, 5xx -> ERROR).
 */
export function logRequestCompletion(
  req: {
    method: string;
    url: string;
    ip?: string;
    headers?: Record<string, unknown>;
    query?: unknown;
    params?: unknown;
    log: {
      info: (data: unknown, msg: string) => void;
      warn: (data: unknown, msg: string) => void;
      error: (data: unknown, msg: string) => void;
    };
    user?: {
      id?: string;
      role?: string;
      adminRoleName?: string | null;
      [key: string]: unknown;
    };
    routeError?: unknown;
  },
  reply: {
    statusCode: number;
    elapsedTime?: number;
    routeError?: unknown;
  },
  err?: unknown,
): void {
  const statusCode = reply.statusCode;
  const responseTime =
    typeof reply.elapsedTime === "number"
      ? Math.round(reply.elapsedTime * 100) / 100
      : undefined;

  const userAgent =
    typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : undefined;

  const logPayload: Record<string, unknown> = {
    method: req.method,
    url: req.url,
    statusCode,
    responseTime,
    ip: req.ip,
    userAgent,
    userId: req.user?.id,
    userRole: req.user?.role,
    adminRole: req.user?.adminRoleName ?? undefined,
  };

  if (req.query && typeof req.query === "object" && Object.keys(req.query).length > 0) {
    logPayload.query = req.query;
  }
  if (req.params && typeof req.params === "object" && Object.keys(req.params).length > 0) {
    logPayload.params = req.params;
  }

  const resolvedErr = err ?? req.routeError ?? reply.routeError;
  if (resolvedErr) {
    logPayload.err = resolvedErr;
  }

  if (statusCode >= 500) {
    req.log.error(logPayload, "request failed");
  } else if (statusCode >= 400) {
    req.log.warn(logPayload, "request completed with client error");
  } else {
    req.log.info(logPayload, "request completed");
  }
}

