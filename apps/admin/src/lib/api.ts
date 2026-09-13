import type {
  AdminAuthResponse,
  AdminDashboardStats,
  AdminItemsResponse,
  AdminLogEntryDTO,
  AdminLogsOverviewDTO,
  AdminMeResponse,
  AdminPermission,

  AdminRole,
  AdminRoleDetailResponse,
  AdminRolesResponse,
  AdminTagsResponse,
  AdminTopicsResponse,
  AdminUserWithRole,
  AdminUsersResponse,
  ApiErrorResponse,
  CacheKeyDetailResponse,
  CacheKeysListResponse,
  CacheOverviewResponse,
  CampaignsResponse,
  ClearCacheInput,
  ClearCacheResponse,
  DeleteCacheKeyResponse,
  MeResponse,
  PresetAvatar,
  PublicUser,
  Source,
  SourcesResponse,
  SyncRunsResponse,
  SystemSettingsResponse,
  Tag,
  TagsResponse,
  Topic,
  TriggerSourceRunResponse,
} from "@attune/types";
import type {
  AdminLoginInput,
  AdminLogsQueryInput,
  CampaignInput,

  ChangePasswordInput,
  ItemPatchInput,
  PatchMeInput,
  PatchSystemSettingsInput,
  ResetPasswordInput,
  RoleCreateInput,
  RolePatchInput,
  SourceCreateInput,
  SourcePatchInput,
  TagCreateInput,
  TagPatchInput,
  TopicCreateInput,
  TopicPatchInput,
  UserPatchInput,
  VerifyEmailChangeInput,
} from "@attune/schemas";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const ACCESS_TOKEN_KEY = "attune.admin.accessToken";
const REFRESH_TOKEN_KEY = "attune.admin.refreshToken";
const USER_KEY = "attune.admin.user";
const ROLE_KEY = "attune.admin.role";
const PERMISSIONS_KEY = "attune.admin.permissions";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

/** Backward compatibility helper */
export function getToken(): string | null {
  return getAccessToken();
}

/** Resolves relative avatar paths against API_URL */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  return `${API_URL}${cleanUrl}`;
}

export function setSession(data: {
  accessToken: string;
  refreshToken: string;
  user: AdminUserWithRole;
  role: AdminRole;
  permissions: AdminPermission[];
}) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  window.localStorage.setItem(ROLE_KEY, JSON.stringify(data.role));
  window.localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(data.permissions));
}

export function setTokens(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(ROLE_KEY);
  window.localStorage.removeItem(PERMISSIONS_KEY);
}

export function getStoredUser(): AdminUserWithRole | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getStoredRole(): AdminRole | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ROLE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getStoredPermissions(): AdminPermission[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(PERMISSIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export class AdminApiError extends Error {
  public status: number;
  public statusCode: number;
  public code?: string;
  public fields?: Record<string, string>;
  public body: ApiErrorResponse;

  constructor(status: number, body: ApiErrorResponse) {
    super(body?.error ?? `API error ${status}`);
    this.name = "AdminApiError";
    this.status = status;
    this.statusCode = status;
    this.code = body?.code;
    this.fields = body?.fields;
    this.body = body;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

export async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearToken();
      return false;
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  if (init.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof AdminApiError) throw err;
    throw new AdminApiError(0, {
      error: `Network error: Unable to connect to API at ${API_URL}. Please ensure the backend API server is running on port 3000.`,
      code: "NETWORK_ERROR",
    });
  }

  if (res.status === 401 && retry && getRefreshToken()) {
    const ok = await (refreshInFlight ??= doRefresh().finally(() => (refreshInFlight = null)));
    if (ok) {
      return request<T>(path, init, false);
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    throw new AdminApiError(res.status, body);
  }
  return (await res.json()) as T;
}

export const adminApi = {
  // Generic HTTP helpers
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),

  // Strongly typed domain services
  auth: {
    login: async (input: AdminLoginInput): Promise<AdminAuthResponse> => {
      const data = await request<AdminAuthResponse>("/v1/admin/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setSession(data);
      return data;
    },
    me: () => request<AdminMeResponse>("/v1/admin/auth/me"),
    forgotPassword: (email: string) =>
      request<{ message: string; expiresInSeconds: number }>("/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    resetPassword: (input: ResetPasswordInput) =>
      request<{ message: string }>("/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },

  me: {
    get: () => request<MeResponse>("/v1/me"),
    patch: async (input: PatchMeInput) => {
      const data = await request<{ user: PublicUser }>("/v1/me", {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      if (typeof window !== "undefined") {
        const storedUser = getStoredUser();
        if (storedUser) {
          window.localStorage.setItem(USER_KEY, JSON.stringify({ ...storedUser, ...data.user }));
        }
      }
      return data;
    },
    avatars: () => request<{ avatars: PresetAvatar[] }>("/v1/me/avatars"),
    requestEmailChange: (newEmail: string) =>
      request<{ message: string; expiresInSeconds: number }>("/v1/me/email/request", {
        method: "POST",
        body: JSON.stringify({ newEmail }),
      }),
    verifyEmailChange: async (input: VerifyEmailChangeInput) => {
      const data = await request<{ user: PublicUser; message: string }>("/v1/me/email/verify", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (typeof window !== "undefined") {
        const storedUser = getStoredUser();
        if (storedUser) {
          window.localStorage.setItem(USER_KEY, JSON.stringify({ ...storedUser, ...data.user }));
        }
      }
      return data;
    },
    changePassword: (input: ChangePasswordInput) =>
      request<{ message: string }>("/v1/me/password", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },

  roles: {
    list: () => request<AdminRolesResponse>("/v1/admin/roles"),
    get: (id: string) => request<AdminRoleDetailResponse>(`/v1/admin/roles/${id}`),
    create: (input: RoleCreateInput) =>
      request<AdminRoleDetailResponse>("/v1/admin/roles", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    patch: (id: string, input: RolePatchInput) =>
      request<AdminRoleDetailResponse>(`/v1/admin/roles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/v1/admin/roles/${id}`, {
        method: "DELETE",
      }),
  },

  stats: {
    get: () => request<AdminDashboardStats>("/v1/admin/stats"),
  },

  sources: {
    list: () => request<SourcesResponse>("/v1/admin/sources"),
    get: (id: string) => request<{ source: Source }>(`/v1/admin/sources/${id}`),
    create: (input: SourceCreateInput) =>
      request<{ source: Source }>("/v1/admin/sources", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    patch: (id: string, input: SourcePatchInput) =>
      request<{ source: Source }>(`/v1/admin/sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/v1/admin/sources/${id}`, {
        method: "DELETE",
      }),
    run: (id: string) =>
      request<TriggerSourceRunResponse>(`/v1/admin/sources/${id}/run`, {
        method: "POST",
      }),
  },

  topics: {
    list: () => request<AdminTopicsResponse>("/v1/admin/topics"),
    create: (input: TopicCreateInput) =>
      request<{ topic: Topic }>("/v1/admin/topics", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    patch: (id: string, input: TopicPatchInput) =>
      request<{ topic: Topic }>(`/v1/admin/topics/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/v1/admin/topics/${id}`, {
        method: "DELETE",
      }),
  },

  users: {
    list: (params?: { q?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.q?.trim()) qs.set("q", params.q.trim());
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.offset !== undefined) qs.set("offset", String(params.offset));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<AdminUsersResponse>(`/v1/admin/users${suffix}`);
    },
    patch: (id: string, input: UserPatchInput) =>
      request<{ user: { id: string; disabledAt: string | null } }>(`/v1/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    assignRole: (userId: string, roleId: string | null) =>
      request<{ user: { id: string; adminRoleId: string | null } }>(`/v1/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ roleId }),
      }),
  },

  items: {
    list: (params?: {
      q?: string;
      topic?: string;
      sourceId?: string;
      hidden?: "true" | "false";
      reported?: "true" | "false";
      limit?: number;
      offset?: number;
    }) => {
      const qs = new URLSearchParams();
      if (params?.q?.trim()) qs.set("q", params.q.trim());
      if (params?.topic?.trim()) qs.set("topic", params.topic.trim());
      if (params?.sourceId?.trim()) qs.set("sourceId", params.sourceId.trim());
      if (params?.hidden) qs.set("hidden", params.hidden);
      if (params?.reported) qs.set("reported", params.reported);
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.offset !== undefined) qs.set("offset", String(params.offset));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<AdminItemsResponse>(`/v1/admin/items${suffix}`);
    },
    patch: (id: string, input: ItemPatchInput) =>
      request<{ item: { id: string; hidden: boolean } }>(`/v1/admin/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    dismissReports: (id: string) =>
      request<{ item: { id: string; reportsCount: number; hidden: boolean } }>(
        `/v1/admin/items/${id}/dismiss-reports`,
        {
          method: "POST",
        },
      ),
  },

  tags: {
    list: (topicId?: string) => {
      const suffix = topicId ? `?topicId=${encodeURIComponent(topicId)}` : "";
      return request<TagsResponse>(`/v1/tags${suffix}`);
    },
    listAdmin: () => request<AdminTagsResponse>("/v1/admin/tags"),
    create: (input: TagCreateInput) =>
      request<{ tag: Tag }>("/v1/admin/tags", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    patch: (id: string, input: TagPatchInput) =>
      request<{ tag: Tag }>(`/v1/admin/tags/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/v1/admin/tags/${id}`, {
        method: "DELETE",
      }),
  },

  settings: {
    get: () => request<SystemSettingsResponse>("/v1/admin/settings"),
    patch: (input: PatchSystemSettingsInput) =>
      request<SystemSettingsResponse>("/v1/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  },

  campaigns: {
    list: (params?: { limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.offset !== undefined) qs.set("offset", String(params.offset));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<CampaignsResponse>(`/v1/admin/campaigns${suffix}`);
    },
    send: (input: CampaignInput) =>
      request<{ queued: true; jobId: string }>("/v1/admin/campaigns", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },

  syncRuns: {
    list: (params?: { sourceId?: string; status?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.sourceId) qs.set("sourceId", params.sourceId);
      if (params?.status) qs.set("status", params.status);
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.offset !== undefined) qs.set("offset", String(params.offset));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<SyncRunsResponse>(`/v1/admin/sync-runs${suffix}`);
    },
  },

  cache: {
    overview: () => request<CacheOverviewResponse>("/v1/admin/cache/overview"),
    keys: (params?: { prefix?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.prefix) qs.set("prefix", params.prefix);
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<CacheKeysListResponse>(`/v1/admin/cache/keys${suffix}`);
    },
    getKey: (key: string) =>
      request<CacheKeyDetailResponse>(`/v1/admin/cache/keys/${encodeURIComponent(key)}`),
    deleteKey: (key: string) =>
      request<DeleteCacheKeyResponse>(`/v1/admin/cache/keys/${encodeURIComponent(key)}`, {
        method: "DELETE",
      }),
    clear: (input: ClearCacheInput) =>
      request<ClearCacheResponse>("/v1/admin/cache/clear", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },
  logs: {
    list: (params?: AdminLogsQueryInput, init?: RequestInit) => {
      const qs = new URLSearchParams();
      if (params?.service && params.service !== "all") qs.set("service", params.service);
      if (params?.level && params.level !== "all") qs.set("level", params.level);
      if (params?.requestId) qs.set("requestId", params.requestId);
      if (params?.runId) qs.set("runId", params.runId);
      if (params?.jobId) qs.set("jobId", String(params.jobId));
      if (params?.userId) qs.set("userId", params.userId);
      if (params?.sourceId) qs.set("sourceId", params.sourceId);
      if (params?.q) qs.set("q", params.q);
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.offset !== undefined) qs.set("offset", String(params.offset));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<AdminLogsOverviewDTO>(`/v1/admin/logs${suffix}`, init);
    },

    clear: () =>
      request<{ cleared: true; deletedCount: number }>("/v1/admin/logs", {
        method: "DELETE",
      }),
  },
};


export const api = adminApi;

/** Ensures we have a valid, unexpired access token (refreshes if expired or expiring soon). */
export async function getFreshAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(base64));
      const expMs = payload.exp ? payload.exp * 1000 : 0;
      // If expired or expiring within 60 seconds, refresh immediately
      if (Date.now() >= expMs - 60_000) {
        const ok = await doRefresh();
        if (ok) return getAccessToken();
      }
    }
  } catch {
    // fallback
  }
  return token;
}

/** Bull Board relative proxy URL for same-origin iframe embedding (token-guarded with jobs:read). */
export async function bullBoardUrl(subPath = ""): Promise<string> {
  const token = await getFreshAccessToken();
  const cleanPath = subPath
    ? subPath.startsWith("/")
      ? subPath
      : `/${subPath}`
    : "/";
  const tokenQuery = token ? `token=${encodeURIComponent(token)}` : "";
  const sep = cleanPath.includes("?") ? "&" : "?";
  return `/admin/queues${cleanPath}${tokenQuery ? `${sep}${tokenQuery}` : ""}`;
}

/** Bull Board direct external URL for opening in a new tab/window. */
export async function bullBoardExternalUrl(subPath = ""): Promise<string> {
  const token = await getFreshAccessToken();
  const cleanPath = subPath
    ? subPath.startsWith("/")
      ? subPath
      : `/${subPath}`
    : "/";
  const tokenQuery = token ? `token=${encodeURIComponent(token)}` : "";
  const sep = cleanPath.includes("?") ? "&" : "?";
  return `${API_URL}/admin/queues${cleanPath}${tokenQuery ? `${sep}${tokenQuery}` : ""}`;
}
