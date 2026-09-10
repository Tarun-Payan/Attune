import { z } from "zod";
import { campaignSchema } from "./notification";

export const syncSourceJobSchema = z.object({
  sourceId: z.string().min(1, "sourceId is required"),
});

export const notifyItemsJobSchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one itemId is required"),
});

export const welcomeEmailJobSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  email: z.string().email("Invalid email address"),
  name: z.string().optional(),
});

export const campaignJobSchema = campaignSchema;

export const heartbeatJobSchema = z.object({}).passthrough();
export const sweepJobSchema = z.object({}).passthrough();
export const summarizeJobSchema = z.object({}).passthrough();
export const clusterJobSchema = z.object({}).passthrough();

export type SyncSourceJobInput = z.infer<typeof syncSourceJobSchema>;
export type NotifyItemsJobInput = z.infer<typeof notifyItemsJobSchema>;
export type WelcomeEmailJobInput = z.infer<typeof welcomeEmailJobSchema>;
export type CampaignJobInput = z.infer<typeof campaignJobSchema>;
