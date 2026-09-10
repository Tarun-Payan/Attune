import { randomUUID } from "node:crypto";
import { getRedisClient } from "@attune/cache";
import { childLogger } from "./logger";

const log = childLogger({ component: "ai" });

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function model(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

/** Global rate limits configured via environment variables */
export const AI_MAX_RPM = Number(process.env.AI_MAX_RPM ?? 15);
export const AI_MAX_RPD = Number(process.env.AI_MAX_RPD ?? 300);

function getRedis() {
  try {
    return getRedisClient();
  } catch {
    return null;
  }
}

const RPM_WINDOW_MS = 60_000;
const RPD_WINDOW_MS = 24 * 60 * 60 * 1000;
const RPM_KEY = "ai:ratelimit:rpm";
const RPD_KEY = "ai:ratelimit:rpd";

/**
 * Atomically cleans both sliding windows and either reserves a slot or returns
 * the time until the oldest RPM entry leaves its window.
 */
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
  return { 0, 0, rpdCount }
end

local rpmCount = redis.call("ZCARD", rpmKey)
if rpmCount >= maxRpm then
  local oldest = redis.call("ZRANGE", rpmKey, 0, 0, "WITHSCORES")
  local waitMs = math.max(1, tonumber(oldest[2]) + 60000 - now + 50)
  return { 2, waitMs, rpdCount }
end

redis.call("ZADD", rpmKey, now, member)
redis.call("EXPIRE", rpmKey, 120)
redis.call("ZADD", rpdKey, now, member)
redis.call("EXPIRE", rpdKey, 90000)
return { 1, 0, rpdCount + 1 }
`;

type RateLimitScriptResult = [status: number, waitMs: number, rpdCount: number];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Global rate limiter stored in Redis.
 * enforcing AI_MAX_RPM and AI_MAX_RPD across all AI calls in the project.
 */
async function acquireRateLimitSlot(): Promise<boolean> {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") {
    log.warn({ redisStatus: redis?.status ?? "unavailable" }, "Redis is unavailable; skipping AI request");
    return false;
  }

  try {
    while (true) {
      const now = Date.now();
      const [status, waitMs, rpdCount] = await redis.eval(
        ACQUIRE_RATE_LIMIT_SLOT_LUA,
        2,
        RPM_KEY,
        RPD_KEY,
        now,
        now - RPM_WINDOW_MS,
        now - RPD_WINDOW_MS,
        AI_MAX_RPM,
        AI_MAX_RPD,
        `${now}:${randomUUID()}`,
      ) as RateLimitScriptResult;

      if (status === 1) return true;
      if (status === 0) {
        log.warn({ used: rpdCount, maxRpd: AI_MAX_RPD }, "AI daily limit reached (AI_MAX_RPD)");
        return false;
      }

      log.info({ waitMs, maxRpm: AI_MAX_RPM }, "Throttling AI request to respect AI_MAX_RPM");
      await sleep(waitMs);
    }
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "Redis rate limiter failed; skipping AI request");
    return false;
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

interface GenerateOptions {
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}

/**
 * Low-level Gemini call: system-style prompt → plain text response.
 * Returns null on ANY failure — callers must treat AI as best-effort.
 */
async function generate(prompt: string, options: GenerateOptions = {}): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const allowed = await acquireRateLimitSlot();
  if (!allowed) return null;

  const { maxTokens = 1024, jsonMode = false, timeoutMs = 35_000 } = options;
  try {
    const res = await fetch(`${API_BASE}/${model()}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.2,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.warn({ status: res.status, body: body.slice(0, 200) }, "Gemini request failed");
      return null;
    }
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return text.trim() || null;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "Gemini request error");
    return null;
  }
}

async function generateJson<T>(prompt: string, maxTokens = 1024): Promise<T | null> {
  const text = await generate(
    `${prompt}\n\nRespond with ONLY valid JSON. No markdown fences, no commentary.`,
    { maxTokens, jsonMode: true },
  );
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    log.warn({ sample: cleaned.slice(0, 120) }, "Gemini returned unparsable JSON");
    return null;
  }
}

/** 2–3 sentence TL;DR for a story (blueprint §6 enrichment step 4). */
export async function summarizeStory(title: string, content: string): Promise<string | null> {
  const snippet = content.slice(0, 3000);
  return generate(
    `You write ultra-concise news summaries for a minimal news app.
Summarize this story in 2-3 short sentences (max 320 characters). Plain text only, no bullet points, no preamble.

TITLE: ${title}
CONTENT: ${snippet}`,
    { maxTokens: 512, jsonMode: false },
  );
}

/** Categorize a story into our fixed topic taxonomy (AI fallback, blueprint §6 step 3). */
export async function categorizeStory(
  title: string,
  content: string,
  topicKeys: string[],
): Promise<{ key: string; confidence: number }[] | null> {
  const result = await generateJson<{ topics: { key: string; confidence: number }[] }>(
    `You categorize news stories. Choose 1-3 topics from EXACTLY this list:
[${topicKeys.join(", ")}]

Return JSON with this exact structure: {"topics":[{"key":"<from list>","confidence":0.0-1.0}]}

TITLE: ${title}
CONTENT: ${content.slice(0, 1500)}`,
    1024,
  );
  if (!result?.topics) return null;
  const valid = new Set(topicKeys);
  return result.topics
    .filter((t) => valid.has(t.key) && Number.isFinite(t.confidence))
    .slice(0, 3)
    .map((t) => ({ key: t.key, confidence: Math.min(0.95, Math.max(0.3, Number(t.confidence))) }));
}
