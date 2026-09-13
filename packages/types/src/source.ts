import type { SourceType, SyncStatus } from "./enums";

export type SourceConfig = Record<string, unknown>;

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  config: SourceConfig;
  enabled: boolean;
  credibility: number;
  lastSyncAt: Date | string | null;
  createdAt?: Date | string;
}

export interface SyncRun {
  id: string;
  sourceId: string;
  sourceName?: string;
  sourceType?: SourceType;
  jobId?: string | null;
  status: SyncStatus;
  itemsFound: number;
  itemsNew: number;
  error: string | null;
  startedAt: Date | string;
  finishedAt: Date | string | null;
}

export interface NormalizedItem {
  externalId: string;
  url: string;
  title: string;
  content: string;
  author?: string;
  imageUrl?: string;
  metrics?: Record<string, number>;
  publishedAt: Date;
  topicHints?: string[];
}

export interface SourcesResponse {
  count: number;
  sources: Source[];
}

export interface SyncRunsResponse {
  count: number;
  runs: SyncRun[];
}

export interface SourceOption {
  id: string;
  name: string;
}

export interface TriggerSourceRunResponse {
  queued: true;
  jobId?: string;
  source?: string;
}

