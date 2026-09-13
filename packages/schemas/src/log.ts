import { z } from "zod";

export const adminLogsQuerySchema = z.object({
  service: z.string().optional(),
  level: z.string().optional(),
  requestId: z.string().optional(),
  runId: z.string().optional(),
  jobId: z.string().optional(),
  userId: z.string().optional(),
  sourceId: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const adminClearLogsResponseSchema = z.object({
  cleared: z.literal(true),
  deletedCount: z.number(),
});

export const adminLogEntrySchema = z
  .object({
    time: z.number(),
    level: z.number(),
    levelLabel: z.string(),
    service: z.string(),
    environment: z.string().optional(),
    msg: z.string(),
    requestId: z.string().optional(),
    jobId: z.union([z.string(), z.number()]).optional(),
    jobName: z.string().optional(),
    runId: z.string().optional(),
    userId: z.string().optional(),
    userRole: z.string().optional(),
    adminRole: z.string().optional(),
    ip: z.string().optional(),
    userAgent: z.string().optional(),
    method: z.string().optional(),
    url: z.string().optional(),
    statusCode: z.number().optional(),
    responseTime: z.number().optional(),
    query: z.record(z.string(), z.unknown()).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    component: z.string().optional(),
    queue: z.string().optional(),
    sourceId: z.string().optional(),
    source: z.string().optional(),
    err: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const adminLogsOverviewResponseSchema = z.object({
  count: z.number(),
  totalInBuffer: z.number(),
  maxCache: z.number(),
  logs: z.array(adminLogEntrySchema),
});

export type AdminLogsQueryInput = z.input<typeof adminLogsQuerySchema>;
export type AdminLogsQueryOutput = z.output<typeof adminLogsQuerySchema>;
export type AdminLogEntrySchemaType = z.infer<typeof adminLogEntrySchema>;
export type AdminLogsOverviewSchemaType = z.infer<typeof adminLogsOverviewResponseSchema>;


