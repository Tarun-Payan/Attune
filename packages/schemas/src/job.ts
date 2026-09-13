import { z } from "zod";
import { campaignSchema } from "./notification";

export const jobContextSchema = z
  .object({
    requestId: z.string().optional(),
    runId: z.string().optional(),
    userId: z.string().optional(),
  })
  .optional();

export const syncSourceJobSchema = z.object({
  sourceId: z.string().min(1, "sourceId is required"),
  context: jobContextSchema,
});

export const notifyItemsJobSchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one itemId is required"),
  context: jobContextSchema,
});

export const welcomeEmailJobSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  email: z.string().email("Invalid email address"),
  name: z.string().optional(),
  context: jobContextSchema,
});

export const campaignJobSchema = campaignSchema.extend({
  context: jobContextSchema,
});

export const heartbeatJobSchema = z
  .object({
    context: jobContextSchema,
  })
  .passthrough();

export const sweepJobSchema = z
  .object({
    context: jobContextSchema,
  })
  .passthrough();

export const summarizeJobSchema = z
  .object({
    context: jobContextSchema,
  })
  .passthrough();

export const clusterJobSchema = z
  .object({
    context: jobContextSchema,
  })
  .passthrough();

export type JobContextInput = z.infer<typeof jobContextSchema>;
export type SyncSourceJobInput = z.infer<typeof syncSourceJobSchema>;
export type NotifyItemsJobInput = z.infer<typeof notifyItemsJobSchema>;
export type WelcomeEmailJobInput = z.infer<typeof welcomeEmailJobSchema>;
export type CampaignJobInput = z.infer<typeof campaignJobSchema>;
