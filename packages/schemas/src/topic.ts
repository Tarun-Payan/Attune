import { z } from "zod";

// ── Topic Request Schemas ──────────────────────────────────────────────────

export const topicCreateSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .max(60, "Key is too long")
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
  name: z.string().min(1, "Name is required").max(80, "Name is too long"),
  icon: z.string().max(60, "Icon is too long").optional(),
});

export const topicPatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  icon: z.string().max(60).optional(),
});

// ── Tag Request Schemas ────────────────────────────────────────────────────

export const tagCreateSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .max(60, "Key is too long")
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
  name: z.string().min(1, "Name is required").max(80, "Name is too long"),
  topicId: z.string().optional().nullable(),
});

export const tagPatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  topicId: z.string().optional().nullable(),
});

// ── Tag Response Schemas ───────────────────────────────────────────────────

export const tagSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  topicId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const tagsResponseSchema = z.object({
  count: z.number(),
  tags: z.array(tagSchema),
});

export const adminTagRowSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  topicId: z.string().nullable().optional(),
  itemCount: z.number(),
  topicName: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const adminTagsResponseSchema = z.object({
  count: z.number(),
  tags: z.array(adminTagRowSchema),
});

// ── Topic Response Schemas ─────────────────────────────────────────────────

export const topicSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  parentId: z.string().nullable().optional(),
  tags: z.array(tagSchema).optional(),
});

export const topicsListResponseSchema = z.object({
  count: z.number(),
  topics: z.array(topicSchema),
});

export const adminTopicRowSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  itemTotal: z.number(),
  itemWeek: z.number(),
  followers: z.number(),
  tagCount: z.number().optional(),
});

export const adminTopicsListResponseSchema = z.object({
  count: z.number(),
  topics: z.array(adminTopicRowSchema),
});

// ── Inferred Types ─────────────────────────────────────────────────────────

export type TopicCreateInput = z.infer<typeof topicCreateSchema>;
export type TopicPatchInput = z.infer<typeof topicPatchSchema>;
export type TopicDTO = z.infer<typeof topicSchema>;
export type AdminTopicRowDTO = z.infer<typeof adminTopicRowSchema>;

export type TagCreateInput = z.infer<typeof tagCreateSchema>;
export type TagPatchInput = z.infer<typeof tagPatchSchema>;
export type TagDTO = z.infer<typeof tagSchema>;
export type AdminTagRowDTO = z.infer<typeof adminTagRowSchema>;
