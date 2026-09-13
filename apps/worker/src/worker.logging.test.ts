import { describe, it, expect, vi } from "vitest";
import * as services from "./services";
import { ingestProcessor } from "./processors/ingest";
import { welcomeEmailProcessor } from "./processors/welcome";
import * as mailer from "./lib/mailer";
import * as repo from "./repository";

describe("Worker Logging & Correlation", () => {
  it("ingestProcessor uses propagated requestId when available", async () => {
    const syncSpy = vi.spyOn(services, "syncSource").mockResolvedValue({
      sourceId: "src_1",
      found: 10,
      added: 5,
    });

    const job = {
      id: "job_manual_123",
      name: "sync",
      data: {
        sourceId: "src_1",
        context: {
          requestId: "req_api_trace_999",
        },
      },
    };

    await ingestProcessor(job as any);

    expect(syncSpy).toHaveBeenCalledWith(
      "src_1",
      expect.objectContaining({
        requestId: "req_api_trace_999",
      }),
    );

    syncSpy.mockRestore();
  });

  it("ingestProcessor generates independent runId when no requestId is present", async () => {
    const syncSpy = vi.spyOn(services, "syncSource").mockResolvedValue({
      sourceId: "src_1",
      found: 10,
      added: 5,
    });

    const job = {
      id: "job_cron_456",
      name: "sync",
      data: {
        sourceId: "src_1",
      },
    };

    await ingestProcessor(job as any);

    expect(syncSpy).toHaveBeenCalledWith(
      "src_1",
      expect.objectContaining({
        requestId: undefined,
        runId: expect.stringMatching(/^run_[0-9a-f-]+$/),
      }),
    );

    syncSpy.mockRestore();
  });

  it("welcomeEmailProcessor logs and processes job with requestId and jobId context", async () => {
    const emailSpy = vi.spyOn(mailer, "sendEmail").mockResolvedValue({ ok: true });
    const logSpy = vi.spyOn(repo, "createNotificationLog").mockResolvedValue({} as any);

    const job = {
      id: "welcome-usr-123",
      name: "send-welcome-email",
      data: {
        userId: "usr-123",
        email: "user@example.com",
        name: "Test User",
        context: {
          requestId: "req_auth_signup_001",
        },
      },
    };

    const res = await welcomeEmailProcessor(job as any);
    expect(res.ok).toBe(true);
    expect(emailSpy).toHaveBeenCalledWith(expect.objectContaining({ to: "user@example.com" }));
    expect(logSpy).toHaveBeenCalled();

    emailSpy.mockRestore();
    logSpy.mockRestore();
  });
});
