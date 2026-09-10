export interface CacheOverviewResponse {
  status: "ready" | "connecting" | "closed" | "unavailable";
  latencyMs: number;
  redisVersion: string;
  uptimeSec: number;
  usedMemoryHuman: string;
  peakMemoryHuman: string;
  connectedClients: number;
  totalKeys: number;
  namespaceCounts: Record<string, number>;
}

export interface CacheKeyItem {
  key: string;
  namespace: string;
  type: string;
  ttl: number;
  sizeBytes?: number;
}

export interface CacheKeysListResponse {
  total: number;
  keys: CacheKeyItem[];
}

export interface CacheKeyDetailResponse {
  key: string;
  namespace: string;
  type: string;
  ttl: number;
  sizeBytes?: number;
  value: unknown;
}

export interface ClearCacheInput {
  namespace: "all" | "topics" | "tags" | "stats" | "feed" | "item" | "custom";
  pattern?: string;
}

export interface ClearCacheResponse {
  cleared: boolean;
  namespace: string;
  deletedCount: number;
}

export interface CacheKeysQuery {
  prefix?: string;
  limit?: number;
}

export interface CacheKeyParam {
  key: string;
}

export interface DeleteCacheKeyResponse {
  deleted: boolean;
  key: string;
}
