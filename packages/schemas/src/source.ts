import { z } from "zod";
import { SOURCE_TYPES, SYNC_STATUSES } from "@attune/types";

// ── Source Request Schemas ─────────────────────────────────────────────────

export const sourceCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(120, "Name is too long"),
  type: z.enum(SOURCE_TYPES),
  config: z.record(z.unknown()),
  credibility: z.number().int().min(1).max(5).default(3),
});

export const sourcePatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  credibility: z.number().int().min(1).max(5).optional(),
});

export const syncRunsQuerySchema = z.object({
  sourceId: z.string().optional(),
  status: z.enum(SYNC_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Source Response Schemas ────────────────────────────────────────────────

export const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(SOURCE_TYPES),
  config: z.record(z.unknown()),
  enabled: z.boolean(),
  credibility: z.number(),
  lastSyncAt: z.union([z.date(), z.string()]).nullable(),
  createdAt: z.union([z.date(), z.string()]).optional(),
});

export const sourcesListResponseSchema = z.object({
  count: z.number(),
  sources: z.array(sourceSchema),
});

export const syncRunSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceName: z.string().optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  status: z.enum(SYNC_STATUSES),
  itemsFound: z.number(),
  itemsNew: z.number(),
  error: z.string().nullable(),
  startedAt: z.union([z.date(), z.string()]),
  finishedAt: z.union([z.date(), z.string()]).nullable(),
});

export const syncRunsListResponseSchema = z.object({
  count: z.number(),
  runs: z.array(syncRunSchema),
});

export const triggerSourceRunResponseSchema = z.object({
  queued: z.literal(true),
  jobId: z.string().optional(),
  source: z.string().optional(),
});

// ── Inferred Types ─────────────────────────────────────────────────────────

export type SourceCreateInput = z.infer<typeof sourceCreateSchema>;
export type SourcePatchInput = z.infer<typeof sourcePatchSchema>;
export type SyncRunsQueryInput = z.infer<typeof syncRunsQuerySchema>;
export type SourceDTO = z.infer<typeof sourceSchema>;
export type SyncRunDTO = z.infer<typeof syncRunSchema>;

