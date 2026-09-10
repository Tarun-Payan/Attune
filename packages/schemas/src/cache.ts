import { z } from "zod";

export const cacheOverviewResponseSchema = z.object({
  status: z.enum(["ready", "connecting", "closed", "unavailable"]),
  latencyMs: z.number(),
  redisVersion: z.string(),
  uptimeSec: z.number(),
  usedMemoryHuman: z.string(),
  peakMemoryHuman: z.string(),
  connectedClients: z.number(),
  totalKeys: z.number(),
  namespaceCounts: z.record(z.number()),
});

export const cacheKeyItemSchema = z.object({
  key: z.string(),
  namespace: z.string(),
  type: z.string(),
  ttl: z.number(),
  sizeBytes: z.number().optional(),
});

export const cacheKeysListResponseSchema = z.object({
  total: z.number(),
  keys: z.array(cacheKeyItemSchema),
});

export const cacheKeyDetailResponseSchema = z.object({
  key: z.string(),
  namespace: z.string(),
  type: z.string(),
  ttl: z.number(),
  sizeBytes: z.number().optional(),
  value: z.unknown(),
});

export const clearCacheInputSchema = z.object({
  namespace: z.enum(["all", "topics", "tags", "stats", "feed", "item", "custom"]).default("all"),
  pattern: z.string().optional(),
});

export const clearCacheResponseSchema = z.object({
  cleared: z.boolean(),
  namespace: z.string(),
  deletedCount: z.number(),
});

export const cacheKeysQuerySchema = z.object({
  prefix: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
});

export const cacheKeyParamSchema = z.object({
  key: z.string().min(1),
});

export const deleteCacheKeyResponseSchema = z.object({
  deleted: z.boolean(),
  key: z.string(),
});

export type CacheOverviewResponseDTO = z.infer<typeof cacheOverviewResponseSchema>;
export type CacheKeyItemDTO = z.infer<typeof cacheKeyItemSchema>;
export type CacheKeysListResponseDTO = z.infer<typeof cacheKeysListResponseSchema>;
export type CacheKeyDetailResponseDTO = z.infer<typeof cacheKeyDetailResponseSchema>;
export type ClearCacheInputDTO = z.infer<typeof clearCacheInputSchema>;
export type ClearCacheResponseDTO = z.infer<typeof clearCacheResponseSchema>;
export type CacheKeysQueryDTO = z.infer<typeof cacheKeysQuerySchema>;
export type CacheKeyParamDTO = z.infer<typeof cacheKeyParamSchema>;
export type DeleteCacheKeyResponseDTO = z.infer<typeof deleteCacheKeyResponseSchema>;
