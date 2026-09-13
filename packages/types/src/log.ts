export interface AdminLogEntryDTO {
  time: number;
  level: number;
  levelLabel: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | string;
  service: string;
  environment: string;
  msg: string;
  requestId?: string;
  jobId?: string | number;
  jobName?: string;
  runId?: string;
  userId?: string;
  userRole?: string;
  adminRole?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  component?: string;
  queue?: string;
  sourceId?: string;
  source?: string;
  err?: {
    type?: string;
    message?: string;
    stack?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AdminLogsOverviewDTO {
  count: number;
  totalInBuffer: number;
  maxCache: number;
  logs: AdminLogEntryDTO[];
}
