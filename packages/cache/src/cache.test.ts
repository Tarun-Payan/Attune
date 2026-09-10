import { describe, expect, it, vi, beforeEach } from "vitest";
import { CACHE_KEYS, CACHE_PREFIX } from "./keys";
import * as clientModule from "./client";
import { get, set, del, getOrSet, delPattern } from "./cache";

describe("CACHE_KEYS", () => {
  it("formats standard keys with prefix", () => {
    expect(CACHE_KEYS.ADMIN_STATS).toBe(`${CACHE_PREFIX}:stats:dashboard`);
    expect(CACHE_KEYS.TOPICS_ALL).toBe(`${CACHE_PREFIX}:topics:all`);
    expect(CACHE_KEYS.userStats("usr_123")).toBe(`${CACHE_PREFIX}:me:stats:usr_123`);
    expect(CACHE_KEYS.userFeedFirstPage("usr_123", "tech")).toBe(`${CACHE_PREFIX}:feed:usr_123:first:tech`);
    expect(CACHE_KEYS.userFeedFirstPage("usr_123")).toBe(`${CACHE_PREFIX}:feed:usr_123:first:all`);
    expect(CACHE_KEYS.userFeedPattern("usr_123")).toBe(`${CACHE_PREFIX}:feed:usr_123:*`);
    expect(CACHE_KEYS.itemDetail("itm_456")).toBe(`${CACHE_PREFIX}:item:itm_456`);
  });
});

describe("Cache operations (mocked Redis)", () => {
  const store = new Map<string, string>();

  const mockRedis = {
    status: "ready",
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, val: string, _mode?: string, _ttl?: number) => {
      store.set(key, val);
      return "OK";
    }),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count++;
      }
      return count;
    }),
    scan: vi.fn(async (_cursor: string, _match: string, pattern: string) => {
      const matched = Array.from(store.keys()).filter((k) =>
        k.startsWith(pattern.replace("*", "")),
      );
      return ["0", matched] as [string, string[]];
    }),
    ping: vi.fn(async () => "PONG"),
    quit: vi.fn(async () => "OK"),
    disconnect: vi.fn(),
  };

  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    vi.spyOn(clientModule, "getRedisClient").mockReturnValue(mockRedis as any);
  });

  it("stores and retrieves a typed object", async () => {
    const data = { id: 1, name: "Test Item" };
    const saved = await set("test:key", data, 60);
    expect(saved).toBe(true);

    const retrieved = await get<typeof data>("test:key");
    expect(retrieved).toEqual(data);
  });

  it("returns null on cache miss", async () => {
    const val = await get("non:existent");
    expect(val).toBeNull();
  });

  it("deletes a key", async () => {
    await set("key:to:delete", { x: 1 });
    const deleted = await del("key:to:delete");
    expect(deleted).toBe(true);
    expect(await get("key:to:delete")).toBeNull();
  });

  it("evaluates getOrSet properly: hits cache on second call", async () => {
    const fetcher = vi.fn(async () => ({ computed: 42 }));

    const res1 = await getOrSet("cached:comp", 60, fetcher);
    expect(res1).toEqual({ computed: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    const res2 = await getOrSet("cached:comp", 60, fetcher);
    expect(res2).toEqual({ computed: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1); // Not called again!
  });

  it("handles delPattern wildcard deletion", async () => {
    await set("attune:cache:feed:u1:page1", { page: 1 });
    await set("attune:cache:feed:u1:page2", { page: 2 });
    await set("attune:cache:feed:u2:page1", { page: 1 });

    const deleted = await delPattern("attune:cache:feed:u1:*");
    expect(deleted).toBe(2);
    expect(await get("attune:cache:feed:u1:page1")).toBeNull();
    expect(await get("attune:cache:feed:u2:page1")).not.toBeNull();
  });

  it("gracefully falls back to fetcher if Redis errors", async () => {
    mockRedis.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const fallbackFetcher = vi.fn(async () => "database result");

    const result = await getOrSet("error:key", 60, fallbackFetcher);
    expect(result).toBe("database result");
    expect(fallbackFetcher).toHaveBeenCalledTimes(1);
  });
});
