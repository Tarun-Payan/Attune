import { describe, expect, it } from "vitest";
import {
  fieldErrors,
  loginSchema,
  notificationSettingsSchema,
  registerSchema,
  sourceCreateSchema,
  topicCreateSchema,
  interactionSchema,
  syncRunsQuerySchema,
  campaignsQuerySchema,
  healthResponseSchema,
  syncSourceJobSchema,
  welcomeEmailJobSchema,
  notifyItemsJobSchema,
  campaignJobSchema,
} from "./index";

describe("registerSchema", () => {
  it("rejects a short password with a human message", () => {
    const r = registerSchema.safeParse({ email: "a@b.co", password: "1234567" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(fieldErrors(r.error).password).toBe("Password must be at least 8 characters");
    }
  });

  it("normalizes email to lowercase + trim", () => {
    const r = registerSchema.safeParse({ email: "  Mixed@Case.COM ", password: "longenough1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("mixed@case.com");
  });
});

describe("loginSchema", () => {
  it("requires the password field explicitly", () => {
    const r = loginSchema.safeParse({ email: "a@b.co", password: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).password).toBe("Password is required");
  });

  it("rejects malformed emails", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "whatever1" });
    expect(r.success).toBe(false);
  });
});

describe("sourceCreateSchema", () => {
  it("validates valid source data", () => {
    const r = sourceCreateSchema.safeParse({
      name: "TechCrunch",
      type: "RSS",
      config: { url: "https://techcrunch.com/feed" },
      credibility: 4,
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid source type", () => {
    const r = sourceCreateSchema.safeParse({
      name: "Bad Source",
      type: "INVALID_TYPE",
      config: {},
    });
    expect(r.success).toBe(false);
  });
});

describe("topicCreateSchema", () => {
  it("validates valid topic key and name", () => {
    const r = topicCreateSchema.safeParse({
      key: "ai-ml",
      name: "AI & Machine Learning",
      icon: "🤖",
    });
    expect(r.success).toBe(true);
  });

  it("rejects uppercase or invalid characters in key", () => {
    const r = topicCreateSchema.safeParse({
      key: "AI_ML",
      name: "AI",
    });
    expect(r.success).toBe(false);
  });
});

describe("interactionSchema", () => {
  it("accepts valid interaction type", () => {
    const r = interactionSchema.safeParse({ type: "LIKE", dwellMs: 12000 });
    expect(r.success).toBe(true);
  });

  it("rejects unknown interaction type", () => {
    const r = interactionSchema.safeParse({ type: "UPVOTE" });
    expect(r.success).toBe(false);
  });
});

describe("notificationSettingsSchema", () => {
  it("accepts a valid partial patch", () => {
    const r = notificationSettingsSchema.safeParse({ pushEnabled: false, maxPushPerHour: 5 });
    expect(r.success).toBe(true);
  });

  it("rejects out-of-range maxPushPerHour", () => {
    expect(notificationSettingsSchema.safeParse({ maxPushPerHour: 0 }).success).toBe(false);
    expect(notificationSettingsSchema.safeParse({ maxPushPerHour: 11 }).success).toBe(false);
  });
});

describe("fieldErrors", () => {
  it("returns one message per field (first wins)", () => {
    const r = registerSchema.safeParse({ email: "nope", password: "x" });
    if (!r.success) {
      const map = fieldErrors(r.error);
      expect(Object.keys(map)).toContain("email");
      expect(Object.keys(map)).toContain("password");
    }
  });
});

describe("pagination schemas", () => {
  it("validates syncRunsQuerySchema with defaults and custom values", () => {
    const d = syncRunsQuerySchema.parse({});
    expect(d.limit).toBe(10);
    expect(d.offset).toBe(0);

    const custom = syncRunsQuerySchema.parse({
      limit: "50",
      offset: "100",
      status: "ok",
      sourceId: "src-1",
    });
    expect(custom.limit).toBe(50);
    expect(custom.offset).toBe(100);
    expect(custom.status).toBe("ok");
    expect(custom.sourceId).toBe("src-1");
  });

  it("validates campaignsQuerySchema with defaults and custom values", () => {
    const d = campaignsQuerySchema.parse({});
    expect(d.limit).toBe(10);
    expect(d.offset).toBe(0);

    const custom = campaignsQuerySchema.parse({ limit: "50", offset: "30" });
    expect(custom.limit).toBe(50);
    expect(custom.offset).toBe(30);
  });

  it("validates healthResponseSchema with valid payload", () => {
    const result = healthResponseSchema.safeParse({
      status: "ok",
      service: "attune-api",
      db: "up",
      uptimeSec: 120,
    });
    expect(result.success).toBe(true);
  });
});

describe("jobSchemas", () => {
  it("validates syncSourceJobSchema", () => {
    expect(syncSourceJobSchema.safeParse({ sourceId: "src-123" }).success).toBe(true);
    expect(syncSourceJobSchema.safeParse({ sourceId: "" }).success).toBe(false);
  });

  it("validates notifyItemsJobSchema", () => {
    expect(notifyItemsJobSchema.safeParse({ itemIds: ["item-1", "item-2"] }).success).toBe(true);
    expect(notifyItemsJobSchema.safeParse({ itemIds: [] }).success).toBe(false);
  });

  it("validates welcomeEmailJobSchema", () => {
    expect(
      welcomeEmailJobSchema.safeParse({
        userId: "u-1",
        email: "user@example.com",
        name: "Alice",
      }).success,
    ).toBe(true);
    expect(welcomeEmailJobSchema.safeParse({ userId: "u-1", email: "not-an-email" }).success).toBe(false);
  });

  it("validates campaignJobSchema", () => {
    expect(
      campaignJobSchema.safeParse({
        title: "News Update",
        body: "Check out new items!",
        channel: "email",
      }).success,
    ).toBe(true);
    expect(campaignJobSchema.safeParse({ title: "", body: "Body", channel: "email" }).success).toBe(false);
  });
});

