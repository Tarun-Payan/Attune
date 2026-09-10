import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { PendingTopic, PublicUser, TokenPair, User } from "../lib/types";
import { API_URL } from "../lib/config";

const KEYS = {
  refresh: "attune.refreshToken",
  user: "attune.user",
};

type SessionUser = User | PublicUser;

interface SessionState {
  status: "hydrating" | "authed" | "guest";
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  pendingTopics: PendingTopic[]; // picked during onboarding, applied after sign-in
  hydrate: () => Promise<void>;
  signIn: (data: { user: SessionUser | null; accessToken: string; refreshToken: string }) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: SessionUser) => void;
  signOutLocal: () => void;
  signOut: () => Promise<void>;
  setPendingTopics: (topics: PendingTopic[]) => void;
}

async function persist(refreshToken: string, user: SessionUser | null) {
  await SecureStore.setItemAsync(KEYS.refresh, refreshToken);
  await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user));
}

async function clearPersisted() {
  await SecureStore.deleteItemAsync(KEYS.refresh);
  await SecureStore.deleteItemAsync(KEYS.user);
}

export const useSession = create<SessionState>((set, get) => ({
  status: "hydrating",
  user: null,
  accessToken: null,
  refreshToken: null,
  pendingTopics: [],

  hydrate: async () => {
    try {
      const refresh = await SecureStore.getItemAsync(KEYS.refresh);
      if (!refresh) {
        set({ status: "guest" });
        return;
      }
      // Hydration doubles as rotation — the stored token is single-use
      const res = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) {
        throw new Error("Failed to refresh token during hydration");
      }
      const data = (await res.json()) as TokenPair & { user: PublicUser };
      await persist(data.refreshToken, data.user);
      set({ status: "authed", user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
    } catch {
      await clearPersisted();
      set({ status: "guest", user: null, accessToken: null, refreshToken: null });
    }
  },

  signIn: async ({ user, accessToken, refreshToken }) => {
    await persist(refreshToken, user);
    set({ status: "authed", user, accessToken, refreshToken });
  },

  setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

  setUser: (user) => set({ user }),

  signOutLocal: () => set({ status: "guest", user: null, accessToken: null, refreshToken: null }),

  signOut: async () => {
    const { refreshToken } = get();
    if (refreshToken) {
      fetch(`${API_URL}/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => undefined);
    }
    await clearPersisted();
    set({ status: "guest", user: null, accessToken: null, refreshToken: null, pendingTopics: [] });
  },

  setPendingTopics: (topics) => set({ pendingTopics: topics }),
}));

