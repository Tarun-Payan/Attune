export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorDetail;
}

export interface ApiErrorDetail {
  code?: string;
  message: string;
  fields?: Record<string, string>;
  hint?: string;
  unknown?: string[];
  [key: string]: unknown;
}

export interface PaginatedResult<T> {
  count: number;
  items: T[];
  nextCursor?: string | null;
}

export interface CursorPayload {
  t: number;
  s: number;
  id: string;
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
  statusCode?: number;
  fields?: Record<string, string>;
  [key: string]: unknown;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  db: "up";
  redis?: "up" | "down";
  uptimeSec: number;
}

