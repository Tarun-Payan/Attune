import { z } from "zod";
import { INTERACTION_TYPES, REPORT_REASONS } from "@attune/types";

// ── Item Request Schemas ───────────────────────────────────────────────────

export const reportReasonSchema = z.enum(REPORT_REASONS);

export const reportItemSchema = z.object({
  reason: reportReasonSchema,
  details: z.string().max(500).optional(),
});

export const interactionSchema = z.object({
  type: z.enum(INTERACTION_TYPES),
  dwellMs: z.number().int().min(0).max(600_000).optional(),
  reason: reportReasonSchema.optional(),
  details: z.string().max(500).optional(),
});

export const itemPatchSchema = z.object({
  hidden: z.boolean(),
});

export const feedQuerySchema = z.object({
  topics: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const searchQuerySchema = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminItemsQuerySchema = z.object({
  q: z.string().optional(),
  topic: z.string().optional(),
  sourceId: z.string().optional(),
  hidden: z.enum(["true", "false"]).optional(),
  reported: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Item Response Schemas ──────────────────────────────────────────────────

export const itemUserStateSchema = z.object({
  liked: z.boolean(),
  disliked: z.boolean(),
  saved: z.boolean(),
});

export const itemTopicConfidenceSchema = z.object({
  key: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  confidence: z.number(),
});

export const itemDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  content: z.string(),
  url: z.string().url(),
  imageUrl: z.string().nullable(),
  author: z.string().nullable(),
  metrics: z.record(z.number()).nullable(),
  language: z.string(),
  publishedAt: z.union([z.date(), z.string()]),
  clusterId: z.string().nullable(),
  sourceName: z.string(),
  sourceCredibility: z.number(),
  topics: z.array(itemTopicConfidenceSchema),
  tags: z.array(z.string()).optional(),
  likesCount: z.number().default(0),
  dislikesCount: z.number().default(0),
  viewsCount: z.number().default(0),
  reportsCount: z.number().default(0),
  userState: itemUserStateSchema.optional(),
});

export const itemDetailResponseSchema = z.object({
  item: itemDetailSchema,
});

export const feedItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  url: z.string(),
  imageUrl: z.string().nullable(),
  author: z.string().nullable().optional(),
  metrics: z.record(z.number()).nullable(),
  publishedAt: z.union([z.date(), z.string()]),
  source: z.object({ name: z.string() }),
  topics: z.array(z.string()),
  tags: z.array(z.string()).optional(),
  clusterSize: z.number().optional(),
  score: z.number(),
  likesCount: z.number().default(0),
  dislikesCount: z.number().default(0),
  viewsCount: z.number().default(0),
  reportsCount: z.number().default(0),
  userState: itemUserStateSchema.optional(),
  isExploration: z.boolean().optional(),
});

export const feedResponseSchema = z.object({
  count: z.number(),
  items: z.array(feedItemSchema),
  nextCursor: z.string().nullable(),
});

export const savedItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: z.union([z.date(), z.string()]),
  savedAt: z.union([z.date(), z.string()]),
});

export const savedItemsResponseSchema = z.object({
  count: z.number(),
  items: z.array(savedItemSchema),
});

export const adminItemRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  author: z.string().nullable(),
  metrics: z.record(z.number()).nullable(),
  hidden: z.boolean(),
  publishedAt: z.string(),
  createdAt: z.string(),
  sourceName: z.string(),
  topics: z.array(z.string()),
  tags: z.array(z.string()).optional(),
  likesCount: z.number().default(0),
  dislikesCount: z.number().default(0),
  viewsCount: z.number().default(0),
  reportsCount: z.number().default(0),
});

export const adminItemsListResponseSchema = z.object({
  count: z.number(),
  items: z.array(adminItemRowSchema),
});

export const interactionResponseSchema = z.object({
  recorded: z.literal(true),
});

// ── Inferred Types ─────────────────────────────────────────────────────────

export type InteractionInput = z.infer<typeof interactionSchema>;
export type ItemPatchInput = z.infer<typeof itemPatchSchema>;
export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type AdminItemsQueryInput = z.infer<typeof adminItemsQuerySchema>;
export type ItemDetailDTO = z.infer<typeof itemDetailSchema>;
export type FeedItemDTO = z.infer<typeof feedItemSchema>;
export type FeedResponseDTO = z.infer<typeof feedResponseSchema>;
export type SavedItemDTO = z.infer<typeof savedItemSchema>;
export type AdminItemRowDTO = z.infer<typeof adminItemRowSchema>;

