import { describe, expect, it, vi } from "vitest";
import { decodeCursor, encodeCursor } from "./feedService";
import { hashPassword, verifyPassword } from "./jwtService";
import { getHealthStatus } from "./healthService";
import { listTopics, listTags } from "./topicService";
import * as healthRepo from "../repository/healthRepository";
import * as topicRepo from "../repository/topicRepository";
import * as tagRepo from "../repository/tagRepository";

vi.mock("@attune/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@attune/cache")>();
  return {
    ...actual,
    getOrSet: vi.fn(async (_key: string, _ttl: number, fetcher: () => Promise<any>) => fetcher()),
    del: vi.fn(async () => true),
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
    checkRedisHealth: vi.fn(async () => ({ status: "up" as const, latencyMs: 1 })),
  };
});

describe("feedService cursor serialization", () => {
  it("encodes and decodes a cursor accurately", () => {
    const payload = { t: 1724500000000, s: 0.845123, id: "item-12345" };
    const encoded = encodeCursor(payload);
    expect(typeof encoded).toBe("string");

    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(payload);
  });

  it("returns null for malformed cursor strings", () => {
    expect(decodeCursor("invalid-base64-json-not-valid")).toBe(null);
    expect(decodeCursor(Buffer.from(JSON.stringify({ t: "not-number" })).toString("base64url"))).toBe(null);
  });
});

describe("jwtService password hashing", () => {
  it("hashes and successfully verifies a password with Argon2", async () => {
    const pass = "SuperSecretPassword123!";
    const hash = await hashPassword(pass);
    expect(hash).not.toBe(pass);

    const valid = await verifyPassword(hash, pass);
    expect(valid).toBe(true);

    const invalid = await verifyPassword(hash, "WrongPassword");
    expect(invalid).toBe(false);
  });
});

describe("healthService", () => {
  it("returns health status with uptime and database state", async () => {
    vi.spyOn(healthRepo, "pingDatabase").mockResolvedValue(true);
    const result = await getHealthStatus();
    expect(result.status).toBe("ok");
    expect(result.db).toBe("up");
    expect(result.service).toBe("attune-api");
    expect(typeof result.uptimeSec).toBe("number");
  });
});

describe("topicService", () => {
  it("returns topic list with count", async () => {
    vi.spyOn(topicRepo, "listTopics").mockResolvedValue([
      { id: "top-1", key: "tech", name: "Technology", icon: "cpu", parentId: null },
    ]);
    const result = await listTopics();
    expect(result.count).toBe(1);
    expect(result.topics[0].key).toBe("tech");
  });

  it("returns tag list with count", async () => {
    vi.spyOn(tagRepo, "listTags").mockResolvedValue([
      { id: "tag-1", key: "ai", name: "AI", topicId: "top-1", createdAt: new Date() },
    ]);
    const result = await listTags("top-1");
    expect(result.count).toBe(1);
    expect(result.tags[0].key).toBe("ai");
  });
});
