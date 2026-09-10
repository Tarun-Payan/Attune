import { randomUUID } from "node:crypto";
import { getRedisClient, isRedisReady } from "./client";

const ACQUIRE_RATE_LIMIT_SLOT_LUA = `
local rpmKey = KEYS[1]
local rpdKey = KEYS[2]
local now = tonumber(ARGV[1])
local minuteAgo = tonumber(ARGV[2])
local dayAgo = tonumber(ARGV[3])
local maxRpm = tonumber(ARGV[4])
local maxRpd = tonumber(ARGV[5])
local member = ARGV[6]

redis.call("ZREMRANGEBYSCORE", rpmKey, 0, minuteAgo)
redis.call("ZREMRANGEBYSCORE", rpdKey, 0, dayAgo)

local rpdCount = redis.call("ZCARD", rpdKey)
if rpdCount >= maxRpd then
  return {"EXHAUSTED", 0, rpdCount}
end

local rpmCount = redis.call("ZCARD", rpmKey)
if rpmCount >= maxRpm then
  local oldest = redis.call("ZRANGE", rpmKey, 0, 0, "WITHSCORES")
  local waitMs = 0
  if #oldest >= 2 then
    waitMs = math.max(0, math.floor(tonumber(oldest[2]) + 60000 - now))
  end
  return {"BUSY", waitMs, rpdCount}
end

redis.call("ZADD", rpmKey, now, member)
redis.call("EXPIRE", rpmKey, 120)
redis.call("ZADD", rpdKey, now, member)
redis.call("EXPIRE", rpdKey, 90000)

return {"OK", 0, rpdCount + 1}
`;

export interface RateLimitOptions {
  rpmKey: string;
  rpdKey: string;
  maxRpm: number;
  maxRpd: number;
  memberId?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  status: "OK" | "BUSY" | "EXHAUSTED" | "UNAVAILABLE";
  waitMs: number;
  currentRpd: number;
}

const RPM_WINDOW_MS = 60_000;
const RPD_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Sliding window distributed rate limiter backed by Redis Lua script.
 * Safely handles both RPM (requests per minute) and RPD (requests per day).
 */
export async function acquireRateLimitSlot(options: RateLimitOptions): Promise<RateLimitResult> {
  const client = getRedisClient();
  if (client.status !== "ready") {
    return {
      allowed: false,
      status: "UNAVAILABLE",
      waitMs: 0,
      currentRpd: 0,
    };
  }

  const now = Date.now();
  const minuteAgo = now - RPM_WINDOW_MS;
  const dayAgo = now - RPD_WINDOW_MS;
  const member = options.memberId ?? `${now}:${randomUUID()}`;

  try {
    const rawResult = (await client.eval(
      ACQUIRE_RATE_LIMIT_SLOT_LUA,
      2,
      options.rpmKey,
      options.rpdKey,
      now,
      minuteAgo,
      dayAgo,
      options.maxRpm,
      options.maxRpd,
      member,
    )) as [string, number, number];

    const [status, waitMs, rpdCount] = rawResult;
    return {
      allowed: status === "OK",
      status: status as "OK" | "BUSY" | "EXHAUSTED",
      waitMs: Number(waitMs),
      currentRpd: Number(rpdCount),
    };
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[RateLimit] Error evaluating rate limit: ${(err as Error).message}`);
    }
    return {
      allowed: false,
      status: "UNAVAILABLE",
      waitMs: 0,
      currentRpd: 0,
    };
  }
}
