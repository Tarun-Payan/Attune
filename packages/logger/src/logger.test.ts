import { describe, it, expect, vi } from "vitest";
import { Writable } from "node:stream";
import pino from "pino";
import {
  createLogger,
  createJobLogger,
  generateRequestId,
  generateRunId,
  getFastifyLoggerConfig,
  logRequestCompletion,
  DEFAULT_REDACT_PATHS,
  REDACT_CENSOR,
} from "./index";

function captureLogs(fn: (logger: ReturnType<typeof createLogger>) => void): Record<string, unknown>[] {
  const logs: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      try {
        logs.push(JSON.parse(chunk.toString()));
      } catch {
        // ignore unparseable
      }
      callback();
    },
  });

  const customLogger = pino(
    {
      level: "debug",
      base: { service: "worker", environment: "test" },
      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
      },
      redact: {
        paths: DEFAULT_REDACT_PATHS,
        censor: REDACT_CENSOR,
      },
    },
    stream,
  );

  fn(customLogger);
  return logs;
}

describe("@attune/logger", () => {
  describe("ID generation", () => {
    it("generates request IDs with req_ prefix", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).toMatch(/^req_[0-9a-f-]+$/);
      expect(id2).toMatch(/^req_[0-9a-f-]+$/);
      expect(id1).not.toBe(id2);
    });

    it("generates run IDs with run_ prefix", () => {
      const id1 = generateRunId();
      const id2 = generateRunId();
      expect(id1).toMatch(/^run_[0-9a-f-]+$/);
      expect(id2).toMatch(/^run_[0-9a-f-]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("createLogger", () => {
    it("creates a logger with service and environment in base bindings", () => {
      const logs = captureLogs((logger) => {
        logger.info("Service test");
      });

      expect(logs.length).toBe(1);
      expect(logs[0].service).toBe("worker");
      expect(logs[0].environment).toBe("test");
      expect(logs[0].msg).toBe("Service test");
      expect(logs[0].level).toBe(30);
    });

    it("redacts sensitive fields in log payloads", () => {
      const logs = captureLogs((logger) => {
        logger.info(
          {
            password: "super-secret-password",
            token: "jwt-token-value",
            otp: "123456",
            apiKey: "secret-key",
            safeData: "visible-value",
          },
          "Redaction test",
        );
      });

      expect(logs.length).toBe(1);
      expect(logs[0].password).toBe("[REDACTED]");
      expect(logs[0].token).toBe("[REDACTED]");
      expect(logs[0].otp).toBe("[REDACTED]");
      expect(logs[0].apiKey).toBe("[REDACTED]");
      expect(logs[0].safeData).toBe("visible-value");
    });

    it("serializes errors with stack traces", () => {
      const err = new Error("Database connection failed");
      const logs = captureLogs((logger) => {
        logger.error({ err }, "Operation failed");
      });

      expect(logs.length).toBe(1);
      const loggedErr = logs[0].err as Record<string, unknown>;
      expect(loggedErr).toBeDefined();
      expect(loggedErr.message).toBe("Database connection failed");
      expect(loggedErr.stack).toBeDefined();
      expect(typeof loggedErr.stack).toBe("string");
    });
  });

  describe("createJobLogger", () => {
    it("binds jobId, queue, and propagated context to child logger", () => {
      const logs = captureLogs((logger) => {
        const jobLogger = createJobLogger(
          logger,
          {
            id: "job_456",
            name: "send-welcome-email",
            data: {
              context: {
                requestId: "req_123",
                userId: "user_789",
              },
            },
          },
          "pipeline",
        );

        jobLogger.info("Welcome email sent");
      });

      expect(logs.length).toBe(1);
      expect(logs[0].jobId).toBe("job_456");
      expect(logs[0].jobName).toBe("send-welcome-email");
      expect(logs[0].queue).toBe("pipeline");
      expect(logs[0].requestId).toBe("req_123");
      expect(logs[0].userId).toBe("user_789");
    });

    it("binds runId for background jobs without requestId", () => {
      const logs = captureLogs((logger) => {
        const jobLogger = createJobLogger(
          logger,
          {
            id: "sync_rss_1",
            name: "sync",
            data: {
              context: {
                runId: "run_abc999",
              },
            },
          },
          "ingest",
        );

        jobLogger.info("RSS sync started");
      });

      expect(logs.length).toBe(1);
      expect(logs[0].jobId).toBe("sync_rss_1");
      expect(logs[0].queue).toBe("ingest");
      expect(logs[0].runId).toBe("run_abc999");
      expect(logs[0].requestId).toBeUndefined();
    });
  });

  describe("getFastifyLoggerConfig", () => {
    it("returns configuration with requestIdLogLabel and x-request-id handling", () => {
      const config = getFastifyLoggerConfig("api");
      expect(config.requestIdLogLabel).toBe("requestId");
      expect(config.requestIdHeader).toBe("x-request-id");
      expect(config.logger.base.service).toBe("api");

      // Custom header used when present
      const reqWithHeader = { headers: { "x-request-id": "client-req-999" } };
      expect(config.genReqId(reqWithHeader)).toBe("client-req-999");

      // Generated ID used when header missing
      const reqWithoutHeader = { headers: {} };
      const generated = config.genReqId(reqWithoutHeader);
      expect(generated).toMatch(/^req_[0-9a-f-]+$/);
    });

    it("emits structured log with rich user and request metadata on completion", () => {
      const mockLog = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const req = {
        method: "GET",
        url: "/v1/admin/sources?active=true",
        ip: "192.168.1.100",
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        query: { active: "true" },
        params: { id: "source_1" },
        user: {
          id: "usr_super_1",
          role: "ADMIN",
          adminRoleName: "Super Admin",
        },
        log: mockLog,
      };

      logRequestCompletion(req, { statusCode: 200, elapsedTime: 24.5 });

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "/v1/admin/sources?active=true",
          statusCode: 200,
          responseTime: 24.5,
          ip: "192.168.1.100",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          userId: "usr_super_1",
          userRole: "ADMIN",
          adminRole: "Super Admin",
          query: { active: "true" },
          params: { id: "source_1" },
        }),
        "request completed",
      );
    });
  });

  describe("Redis Log Buffer", () => {
    it("respects MAX_LOG_CACHE from environment variable", async () => {
      const { getLogBufferMaxCache } = await import("./buffer");
      process.env.MAX_LOG_CACHE = "1500";
      expect(getLogBufferMaxCache()).toBe(1500);

      delete process.env.MAX_LOG_CACHE;
      expect(getLogBufferMaxCache()).toBe(2000);
    });


    it("creates a stream that pipelines lpush and ltrim into redis for warn, error, and debug logs", async () => {
      const { createRedisLogStream } = await import("./buffer");
      const pipelineMock = {
        lpush: vi.fn().mockReturnThis(),
        ltrim: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      const redisMock = {
        pipeline: vi.fn().mockReturnValue(pipelineMock),
        status: "ready",
      };

      const stream = createRedisLogStream(redisMock, { maxCache: 500, redisKey: "test:logs" });
      const warnEntry = JSON.stringify({ level: 40, msg: "warning message", service: "api" });
      stream.write(warnEntry);

      expect(redisMock.pipeline).toHaveBeenCalled();
      expect(pipelineMock.lpush).toHaveBeenCalledWith("test:logs", warnEntry);
      expect(pipelineMock.ltrim).toHaveBeenCalledWith("test:logs", 0, 499);
    });

    it("excludes level 30 (info) logs from Redis buffer while preserving debug (20), warn (40), and error (50+)", async () => {
      const { createRedisLogStream } = await import("./buffer");
      const pipelineMock = {
        lpush: vi.fn().mockReturnThis(),
        ltrim: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      const redisMock = {
        pipeline: vi.fn().mockReturnValue(pipelineMock),
        status: "ready",
      };

      const stream = createRedisLogStream(redisMock, { maxCache: 500, redisKey: "test:logs" });

      // 1) Info log (level 30) - should be excluded from Redis buffer
      stream.write(JSON.stringify({ level: 30, msg: "request completed 200 OK", service: "api" }));
      expect(redisMock.pipeline).not.toHaveBeenCalled();

      // 2) Heartbeat info log (level 30) - should be excluded from Redis buffer
      stream.write(JSON.stringify({ level: 30, jobName: "heartbeat", msg: "heartbeat" }));
      expect(redisMock.pipeline).not.toHaveBeenCalled();

      // 3) Debug log (level 20) - should be included
      const debugLog = JSON.stringify({ level: 20, msg: "cache lookup detail", service: "api" });
      stream.write(debugLog);
      expect(pipelineMock.lpush).toHaveBeenCalledWith("test:logs", debugLog);

      // 4) Warn log (level 40) - should be included
      const warnLog = JSON.stringify({ level: 40, msg: "rate limit threshold reached", service: "api" });
      stream.write(warnLog);
      expect(pipelineMock.lpush).toHaveBeenCalledWith("test:logs", warnLog);

      // 5) Error log (level 50) - should be included
      const errorLog = JSON.stringify({
        level: 50,
        jobName: "heartbeat",
        msg: "heartbeat job failed",
        err: { message: "Redis connection lost" },
      });
      stream.write(errorLog);
      expect(pipelineMock.lpush).toHaveBeenCalledWith("test:logs", errorLog);
    });
  });
});

