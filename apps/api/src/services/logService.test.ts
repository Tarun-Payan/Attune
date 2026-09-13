import { describe, it, expect, vi, beforeEach } from "vitest";
import * as logRepository from "../repository/logRepository";
import { getAdminLogs, clearAdminLogs, getLogStatsSummary } from "./logService";

describe("logService", () => {
  const sampleLogs = [
    JSON.stringify({
      level: 50,
      time: 1710000000000,
      service: "api",
      msg: "Database query timeout",
      requestId: "req_123",
      err: { message: "connection timeout", stack: "Error: timeout\n at query.ts:1" },
    }),
    JSON.stringify({
      level: 40,
      time: 1710000010000,
      service: "worker",
      msg: "Retrying feed sync job",
      jobId: "job_456",
      jobName: "sync-feed",
    }),
    JSON.stringify({
      level: 30,
      time: 1710000020000,
      service: "admin",
      msg: "Admin user logged in",
      userId: "usr_789",
    }),
    JSON.stringify({
      level: 20,
      time: 1710000030000,
      service: "worker",
      msg: "Cache lookup for key",
      runId: "run_abc",
    }),
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns all parsed logs without filters and maps level labels", async () => {
    vi.spyOn(logRepository, "fetchRecentLogsFromBuffer").mockResolvedValue(sampleLogs);
    vi.spyOn(logRepository, "getLogBufferCount").mockResolvedValue(4);

    const result = await getAdminLogs({});

    expect(result.count).toBe(4);
    expect(result.totalInBuffer).toBe(4);
    expect(result.logs).toHaveLength(4);
    expect(result.logs[0].levelLabel).toBe("error");
    expect(result.logs[0].service).toBe("api");
    expect(result.logs[1].levelLabel).toBe("warn");
    expect(result.logs[2].levelLabel).toBe("info");
    expect(result.logs[3].levelLabel).toBe("debug");
  });

  it("filters logs by service", async () => {
    vi.spyOn(logRepository, "fetchRecentLogsFromBuffer").mockResolvedValue(sampleLogs);
    vi.spyOn(logRepository, "getLogBufferCount").mockResolvedValue(4);

    const result = await getAdminLogs({ service: "worker" });

    expect(result.count).toBe(2);
    expect(result.logs.every((l) => l.service === "worker")).toBe(true);
  });

  it("filters logs by level string (error)", async () => {
    vi.spyOn(logRepository, "fetchRecentLogsFromBuffer").mockResolvedValue(sampleLogs);
    vi.spyOn(logRepository, "getLogBufferCount").mockResolvedValue(4);

    const result = await getAdminLogs({ level: "error" });

    expect(result.count).toBe(1);
    expect(result.logs[0].msg).toBe("Database query timeout");
  });

  it("filters logs by requestId", async () => {
    vi.spyOn(logRepository, "fetchRecentLogsFromBuffer").mockResolvedValue(sampleLogs);
    vi.spyOn(logRepository, "getLogBufferCount").mockResolvedValue(4);

    const result = await getAdminLogs({ requestId: "req_123" });

    expect(result.count).toBe(1);
    expect(result.logs[0].requestId).toBe("req_123");
  });

  it("filters logs by search query keyword (q)", async () => {
    vi.spyOn(logRepository, "fetchRecentLogsFromBuffer").mockResolvedValue(sampleLogs);
    vi.spyOn(logRepository, "getLogBufferCount").mockResolvedValue(4);

    const result = await getAdminLogs({ q: "timeout" });

    expect(result.count).toBe(1);
    expect(result.logs[0].msg).toBe("Database query timeout");
  });

  it("clears admin logs buffer", async () => {
    vi.spyOn(logRepository, "clearLogBuffer").mockResolvedValue(150);

    const result = await clearAdminLogs();

    expect(result.cleared).toBe(true);
    expect(result.deletedCount).toBe(150);
  });

  it("respects MAX_LOG_CACHE from env variable", async () => {
    process.env.MAX_LOG_CACHE = "3500";
    vi.spyOn(logRepository, "fetchRecentLogsFromBuffer").mockResolvedValue([]);
    vi.spyOn(logRepository, "getLogBufferCount").mockResolvedValue(0);

    const result = await getAdminLogs({});
    expect(result.maxCache).toBe(3500);

    delete process.env.MAX_LOG_CACHE;
  });

  it("calculates log statistics summary including top errors and impacted users", async () => {
    const errorLogs = [
      JSON.stringify({
        level: 50,
        time: 1710000000000,
        service: "api",
        msg: "Database connection lost",
        userId: "usr_alice",
        err: { message: "connect ECONNREFUSED 127.0.0.1:5432" },
      }),
      JSON.stringify({
        level: 50,
        time: 1710000010000,
        service: "api",
        msg: "Database connection lost",
        userId: "usr_bob",
        err: { message: "connect ECONNREFUSED 127.0.0.1:5432" },
      }),
      JSON.stringify({
        level: 50,
        time: 1710000020000,
        service: "worker",
        msg: "RSS sync failed",
        err: { message: "404 Not Found from RSS feed" },
      }),
      JSON.stringify({
        level: 40,
        time: 1710000030000,
        service: "api",
        msg: "Rate limit reached",
        userId: "usr_alice",
      }),
      JSON.stringify({
        level: 20,
        time: 1710000040000,
        service: "worker",
        msg: "Debug tracing step",
      }),
    ];

    vi.spyOn(logRepository, "fetchRecentLogsFromBuffer").mockResolvedValue(errorLogs);

    const summary = await getLogStatsSummary();

    expect(summary.totalErrors).toBe(3);
    expect(summary.totalWarnings).toBe(1);
    expect(summary.totalDebug).toBe(1);
    expect(summary.impactedUsersCount).toBe(2); // usr_alice, usr_bob
    expect(summary.topErrors).toHaveLength(2);
    expect(summary.topErrors[0].message).toBe("connect ECONNREFUSED 127.0.0.1:5432");
    expect(summary.topErrors[0].count).toBe(2);
    expect(summary.topErrors[0].service).toBe("api");
    expect(summary.topErrors[1].message).toBe("404 Not Found from RSS feed");
    expect(summary.topErrors[1].count).toBe(1);
  });
});

