import { z } from "zod";

// ── Stats Response Schemas ─────────────────────────────────────────────────

export const topTopicInteractionSchema = z.object({
  key: z.string(),
  interactions: z.number(),
});

export const readingStatsResponseSchema = z.object({
  streakDays: z.number(),
  minutesReadWeek: z.number(),
  itemsViewedWeek: z.number(),
  itemsSavedTotal: z.number(),
  totalPlatformMinutes: z.number().default(0),
  topTopicsWeek: z.array(topTopicInteractionSchema),
});

export const failingSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  error: z.string(),
  at: z.string(),
});

export const adminTopTopicSchema = z.object({
  key: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  n: z.number(),
});

export const dailyTrendPointSchema = z.object({
  date: z.string(),
  count: z.number(),
});

export const typeCountPointSchema = z.object({
  type: z.string(),
  count: z.number(),
});

export const logTopErrorItemSchema = z.object({
  message: z.string(),
  count: z.number(),
  service: z.string(),
  lastSeen: z.number(),
});

export const adminLogStatsSummarySchema = z.object({
  totalErrors: z.number(),
  totalWarnings: z.number(),
  totalDebug: z.number(),
  impactedUsersCount: z.number(),
  topErrors: z.array(logTopErrorItemSchema).default([]),
});

export const adminDashboardStatsResponseSchema = z.object({
  usersTotal: z.number(),
  usersNewToday: z.number(),
  itemsTotal: z.number(),
  itemsToday: z.number(),
  interactionsToday: z.number(),
  notifSentToday: z.number(),
  usersTrend: z.array(dailyTrendPointSchema).default([]),
  itemsTrend: z.array(dailyTrendPointSchema).default([]),
  interactionsTrend: z.array(dailyTrendPointSchema).default([]),
  notifTrend: z.array(dailyTrendPointSchema).default([]),
  interactionsByType: z.array(typeCountPointSchema).default([]),
  itemsBySourceType: z.array(typeCountPointSchema).default([]),
  failingSources: z.array(failingSourceSchema),
  topTopics: z.array(adminTopTopicSchema),
  logStats: adminLogStatsSummarySchema.optional(),
});

// ── Inferred Types ─────────────────────────────────────────────────────────

export type ReadingStatsResponseDTO = z.infer<typeof readingStatsResponseSchema>;
export type AdminDashboardStatsDTO = z.infer<typeof adminDashboardStatsResponseSchema>;
export type AdminLogStatsSummaryDTO = z.infer<typeof adminLogStatsSummarySchema>;
export type LogTopErrorItemDTO = z.infer<typeof logTopErrorItemSchema>;
