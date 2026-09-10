import type {
  ApiErrorResponse,
  AuthResponse,
  FeedPage,
  InAppNotification,
  InAppNotificationsResponse,
  ItemDetail,
  MeResponse,
  NotificationSettingsResponse,
  PresetAvatar,
  PublicUser,
  ReadingStats,
  SavedItemsResponse,
  SearchResponse,
  TokenPair,
  TopicsResponse,
  UserPreference,
} from "@attune/types";
import type {
  ChangePasswordInput,
  DeviceRegistrationInput,
  FeedQueryInput,
  ForgotPasswordInput,
  InteractionInput,
  LoginInput,
  NotificationSettingsInput,
  PatchMeInput,
  PreferencesInput,
  RegisterInput,
  ResetPasswordInput,
  SearchQueryInput,
  VerifyEmailChangeInput,
} from "@attune/schemas";
import { useSession } from "../store/session";
import { API_URL } from "./config";

export class ApiError extends Error {
  public status: number;
  public statusCode: number;
  public code?: string;
  public fields?: Record<string, string>;
  public body: ApiErrorResponse;

  constructor(status: number, body: ApiErrorResponse) {
    super(body?.error ?? `API error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.statusCode = status;
    this.code = body?.code;
    this.fields = body?.fields;
    this.body = body;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const { refreshToken, setTokens, signOutLocal } = useSession.getState();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      signOutLocal();
      return false;
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string; user: unknown };
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = useSession.getState().accessToken;
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  if (init.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401 && retry && useSession.getState().refreshToken) {
    const ok = await (refreshInFlight ??= doRefresh().finally(() => (refreshInFlight = null)));
    if (ok) return request<T>(path, init, false);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    throw new ApiError(res.status, body);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const mobileApi = {
  // Generic HTTP helpers for backward compatibility
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),

  // Strongly typed domain services
  auth: {
    login: (input: LoginInput) =>
      request<AuthResponse>(
        "/v1/auth/login",
        { method: "POST", body: JSON.stringify(input) },
        false,
      ),
    register: (input: RegisterInput) =>
      request<AuthResponse>(
        "/v1/auth/register",
        { method: "POST", body: JSON.stringify(input) },
        false,
      ),
    refresh: (refreshToken: string) =>
      request<TokenPair & { user: PublicUser }>(
        "/v1/auth/refresh",
        { method: "POST", body: JSON.stringify({ refreshToken }) },
        false,
      ),
    logout: (refreshToken: string) =>
      request<void>(
        "/v1/auth/logout",
        { method: "POST", body: JSON.stringify({ refreshToken }) },
        false,
      ),
    forgotPassword: (email: string) =>
      request<{ message: string; expiresInSeconds: number }>(
        "/v1/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email }) },
        false,
      ),
    resetPassword: (input: ResetPasswordInput) =>
      request<{ message: string }>(
        "/v1/auth/reset-password",
        { method: "POST", body: JSON.stringify(input) },
        false,
      ),
  },

  me: {
    get: () => request<MeResponse>("/v1/me"),
    patch: (input: PatchMeInput) =>
      request<{ user: PublicUser }>("/v1/me", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    avatars: () => request<{ avatars: PresetAvatar[] }>("/v1/me/avatars"),
    requestEmailChange: (newEmail: string) =>
      request<{ message: string; expiresInSeconds: number }>("/v1/me/email/request", {
        method: "POST",
        body: JSON.stringify({ newEmail }),
      }),
    verifyEmailChange: (input: VerifyEmailChangeInput) =>
      request<{ user: PublicUser; message: string }>("/v1/me/email/verify", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    changePassword: (input: ChangePasswordInput) =>
      request<{ message: string }>("/v1/me/password", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updatePreferences: (input: PreferencesInput) =>
      request<{ count: number; preferences: UserPreference[] }>("/v1/me/preferences", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    updateTopics: (topicKeys: string[]) =>
      request<{ preferences: UserPreference[] }>("/v1/me/preferences", {
        method: "PUT",
        body: JSON.stringify({
          topics: topicKeys.map((key) => ({ key, notify: true })),
        }),
      }),

    getNotificationSettings: () =>
      request<NotificationSettingsResponse>("/v1/me/notification-settings"),
    updateNotificationSettings: (input: NotificationSettingsInput) =>
      request<NotificationSettingsResponse>("/v1/me/notification-settings", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    registerDevice: (input: DeviceRegistrationInput) =>
      request<{ deviceId: string; registered: true }>("/v1/me/devices", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    getStats: () => request<ReadingStats>("/v1/me/stats"),
    getSaved: () => request<SavedItemsResponse>("/v1/me/saved"),
    getNotifications: (params?: { limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.offset !== undefined) qs.set("offset", String(params.offset));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<InAppNotificationsResponse>(`/v1/me/notifications${suffix}`);
    },
    markNotificationRead: (id: string) =>
      request<{ read: true }>(`/v1/me/notifications/${id}/read`, {
        method: "PATCH",
      }),
    markAllNotificationsRead: () =>
      request<{ markedReadCount: number }>("/v1/me/notifications/read-all", {
        method: "POST",
      }),
  },

  feed: {
    get: (params?: FeedQueryInput) => {
      const qs = new URLSearchParams();
      if (params?.topics) qs.set("topics", params.topics);
      if (params?.cursor) qs.set("cursor", params.cursor);
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request<FeedPage>(`/v1/feed${suffix}`);
    },
  },

  items: {
    get: (id: string) => request<{ item: ItemDetail }>(`/v1/items/${id}`),
    interact: (id: string, input: InteractionInput) =>
      request<{ recorded: true }>(`/v1/items/${id}/interactions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },

  topics: {
    list: () => request<TopicsResponse>("/v1/topics"),
  },

  search: {
    query: (params: SearchQueryInput) => {
      const qs = new URLSearchParams({ q: params.q });
      if (params.limit !== undefined) qs.set("limit", String(params.limit));
      return request<SearchResponse>(`/v1/search?${qs.toString()}`);
    },
  },
};

export const api = mobileApi;

/** Resolves relative avatar paths against API_URL */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  return `${API_URL}${cleanUrl}`;
}

