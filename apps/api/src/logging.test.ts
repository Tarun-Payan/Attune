import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { getFastifyLoggerConfig, logRequestCompletion } from "@attune/logger";

describe("API Fastify Logging Integration", () => {
  it("attaches x-request-id to response and honors incoming x-request-id header", async () => {
    const app = Fastify({
      ...getFastifyLoggerConfig("api"),
    });

    app.addHook("onSend", async (req, reply) => {
      reply.header("x-request-id", req.id);
    });

    app.get("/test-log", async (req) => {
      return { ok: true, reqId: req.id };
    });

    // 1) Auto-generated request ID
    const res1 = await app.inject({
      method: "GET",
      url: "/test-log",
    });

    expect(res1.statusCode).toBe(200);
    const generatedId = res1.headers["x-request-id"] as string;
    expect(generatedId).toMatch(/^req_[0-9a-f-]+$/);
    expect(res1.json().reqId).toBe(generatedId);

    // 2) Propagated request ID
    const res2 = await app.inject({
      method: "GET",
      url: "/test-log",
      headers: {
        "x-request-id": "custom-trace-header-12345",
      },
    });

    expect(res2.statusCode).toBe(200);
    expect(res2.headers["x-request-id"]).toBe("custom-trace-header-12345");
    expect(res2.json().reqId).toBe("custom-trace-header-12345");

    await app.close();
  });

  it("configures disableRequestLogging to true to avoid duplicate incoming logs", () => {
    const config = getFastifyLoggerConfig("api");
    expect(config.disableRequestLogging).toBe(true);
  });

  it("logs request completion exactly once with appropriate levels based on status code", () => {
    const mockLog = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const baseReq = {
      method: "GET",
      url: "/v1/items",
      log: mockLog,
      user: { id: "usr_test_1" },
    };

    // 1) 200 OK -> info
    logRequestCompletion(baseReq, { statusCode: 200, elapsedTime: 12.34 });
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/v1/items",
        statusCode: 200,
        responseTime: 12.34,
        userId: "usr_test_1",
      }),
      "request completed",
    );
    expect(mockLog.warn).not.toHaveBeenCalled();
    expect(mockLog.error).not.toHaveBeenCalled();

    // 2) 404 Not Found -> warn
    vi.clearAllMocks();
    const notFoundError = new Error("Resource not found");
    logRequestCompletion(
      { ...baseReq, routeError: notFoundError },
      { statusCode: 404, elapsedTime: 5.67 },
    );
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/v1/items",
        statusCode: 404,
        responseTime: 5.67,
        err: notFoundError,
      }),
      "request completed with client error",
    );
    expect(mockLog.info).not.toHaveBeenCalled();
    expect(mockLog.error).not.toHaveBeenCalled();

    // 3) 500 Internal Server Error -> error
    vi.clearAllMocks();
    const serverError = new Error("Database query failed");
    logRequestCompletion(
      { ...baseReq, routeError: serverError },
      { statusCode: 500, elapsedTime: 45.12 },
    );
    expect(mockLog.error).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/v1/items",
        statusCode: 500,
        responseTime: 45.12,
        err: serverError,
      }),
      "request failed",
    );
    expect(mockLog.info).not.toHaveBeenCalled();
    expect(mockLog.warn).not.toHaveBeenCalled();
  });
});
