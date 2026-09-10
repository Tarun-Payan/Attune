import { z } from "zod";

/**
 * Flatten a ZodError into { fieldName: firstMessage } — one message per field.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export const errorDetailSchema = z.object({
  code: z.string().optional(),
  message: z.string(),
  fields: z.record(z.string()).optional(),
  hint: z.string().optional(),
  unknown: z.array(z.string()).optional(),
});

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: errorDetailSchema,
});

export const apiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const cursorSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const idParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  db: z.literal("up"),
  redis: z.enum(["up", "down"]).optional(),
  uptimeSec: z.number(),
});

export type HealthResponseDTO = z.infer<typeof healthResponseSchema>;
