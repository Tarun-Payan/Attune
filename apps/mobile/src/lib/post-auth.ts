import { useSession } from "../store/session";
import { api } from "./api";
import type { PublicUser, User } from "./types";

/** Sign in, apply onboarding topic picks (if any), and refresh cached queries. */
export async function completeSignIn(
  data: { user: User | PublicUser | null; accessToken: string; refreshToken: string },
  invalidate: () => void,
) {
  const { pendingTopics, signIn, setPendingTopics, setUser } = useSession.getState();
  await signIn(data);

  // OAuth sign-ins carry tokens but no profile — fetch it so the app shows
  // the right name/email immediately
  if (!data.user) {
    try {
      const me = await api.me.get();
      setUser(me.user);
    } catch {
      // non-fatal — profile screen falls back to /v1/me anyway
    }
  }

  if (pendingTopics.length > 0) {
    try {
      await api.me.updatePreferences({ topics: pendingTopics });
      setPendingTopics([]);
    } catch {
      // non-fatal — the user can set topics from Profile later
    }
  }
  invalidate();
}

