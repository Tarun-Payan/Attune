import { describe, expect, it, vi } from "vitest";
import { DEFAULT_JOB_OPTS, CAMPAIGN_JOB_OPTS } from "./constants";
import { allQueues, ingestQueue, pipelineQueue } from "./queues";
import { enqueueSync, enqueueWelcomeEmail, enqueueCampaign } from "./dispatchers";

describe("Queue Constants & Instances", () => {
  it("defines standard retry and exponential backoff", () => {
    expect(DEFAULT_JOB_OPTS.attempts).toBe(3);
    expect(DEFAULT_JOB_OPTS.backoff).toEqual({ type: "exponential", delay: 15_000 });
    expect(CAMPAIGN_JOB_OPTS.attempts).toBe(2);
  });

  it("exports all 3 standard queues", () => {
    expect(allQueues.length).toBe(3);
    expect(allQueues.map((q) => q.name)).toEqual(["ingest", "pipeline", "system"]);
  });
});

describe("Typed Dispatchers", () => {
  it("enqueues valid sync job", async () => {
    const addSpy = vi.spyOn(ingestQueue, "add").mockResolvedValue({ id: "job_1" } as any);

    const res = await enqueueSync({ sourceId: "src_abc" });
    expect(res.id).toBe("job_1");
    expect(addSpy).toHaveBeenCalledWith(
      "sync",
      { sourceId: "src_abc" },
      expect.objectContaining({ attempts: 3 }),
    );

    addSpy.mockRestore();
  });

  it("rejects invalid sync job payload", async () => {
    await expect(enqueueSync({ sourceId: "" })).rejects.toThrow();
  });

  it("rejects invalid email in welcome email job", async () => {
    await expect(
      enqueueWelcomeEmail({ userId: "u1", email: "invalid-email" }),
    ).rejects.toThrow();
  });

  it("enqueues valid campaign job", async () => {
    const addSpy = vi.spyOn(pipelineQueue, "add").mockResolvedValue({ id: "campaign_1" } as any);

    const res = await enqueueCampaign({
      title: "New Feature",
      body: "Check it out!",
      channel: "email",
    });
    expect(res.id).toBe("campaign_1");
    expect(addSpy).toHaveBeenCalledWith(
      "campaign",
      expect.objectContaining({ title: "New Feature" }),
      expect.objectContaining({ attempts: 2 }),
    );

    addSpy.mockRestore();
  });

  it("enqueues jobs with context (requestId, userId) preserved", async () => {
    const addSpy = vi.spyOn(pipelineQueue, "add").mockResolvedValue({ id: "welcome_1" } as any);

    await enqueueWelcomeEmail({
      userId: "u123",
      email: "user@example.com",
      name: "Alice",
      context: {
        requestId: "req_trace_456",
        userId: "u123",
      },
    });

    expect(addSpy).toHaveBeenCalledWith(
      "send-welcome-email",
      {
        userId: "u123",
        email: "user@example.com",
        name: "Alice",
        context: {
          requestId: "req_trace_456",
          userId: "u123",
        },
      },
      expect.objectContaining({ jobId: "welcome-u123" }),
    );

    addSpy.mockRestore();
  });
});
