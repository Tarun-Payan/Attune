import { importPKCS8, SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@attune/db/client";
import { devices } from "@attune/db/schema";
import { childLogger } from "./logger";

const log = childLogger({ component: "push" });

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  ok: boolean;
  error?: string;
  deadTokens: string[];
}

// ── Expo push service (works from Expo Go — our dev transport) ─────────────

export async function sendExpoPush(tokens: string[], msg: PushMessage): Promise<PushResult> {
  const deadTokens: string[] = [];
  const errors: string[] = [];
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        tokens.map((to) => ({ to, title: msg.title, body: msg.body, data: msg.data, channelId: "default" })),
      ),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { ok: false, error: `Expo push HTTP ${res.status}`, deadTokens };
    }
    // Expo wraps the per-token results in { data: [...] }
    const body = (await res.json()) as
      | { data?: { status: string; message?: string; details?: { error?: string } }[] }
      | { status: string; message?: string; details?: { error?: string } }[];
    const results = Array.isArray(body) ? body : (body.data ?? []);
    if (!Array.isArray(results)) {
      return { ok: false, error: "Unexpected Expo push response", deadTokens };
    }
    results.forEach((r, i) => {
      if (r.status === "ok") return;
      if (r.details?.error === "DeviceNotRegistered") deadTokens.push(tokens[i]);
      else errors.push(`${tokens[i].slice(0, 12)}…: ${r.message ?? r.details?.error ?? r.status}`);
    });
    return { ok: errors.length === 0, error: errors.join("; ") || undefined, deadTokens };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), deadTokens };
  }
}

// ── FCM v1 REST (production builds) — no firebase-admin dependency needed ──

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    log.error("FIREBASE_SERVICE_ACCOUNT is set but not valid JSON");
    return null;
  }
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) return cachedAccessToken.token;

  const key = await importPKCS8(sa.private_key.replace(/\\n/g, "\n"), "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`FCM token exchange failed: HTTP ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: data.access_token, expiresAt: now + data.expires_in };
  return data.access_token;
}

export function fcmConfigured(): boolean {
  return serviceAccount() !== null;
}

export async function sendFcmPush(token: string, msg: PushMessage): Promise<PushResult> {
  const sa = serviceAccount();
  if (!sa) return { ok: false, error: "FCM not configured", deadTokens: [] };
  try {
    const accessToken = await fcmAccessToken(sa);
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: msg.data,
          android: { priority: "HIGH" },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true, deadTokens: [] };
    const errBody = (await res.json().catch(() => ({}))) as {
      error?: { details?: { reason?: string }[]; message?: string };
    };
    const unregistered = errBody.error?.details?.[0]?.reason === "UNREGISTERED";
    return {
      ok: false,
      deadTokens: unregistered ? [token] : [],
      error: errBody.error?.message ?? `FCM HTTP ${res.status}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), deadTokens: [] };
  }
}

// ── Shared delivery: all of a user's devices, dead-token pruning ───────────

/**
 * Send one push to every device registered by a user (Expo + FCM transports).
 * Prunes dead tokens and refreshes lastActiveAt on success.
 */
export async function sendToUserDevices(
  userId: string,
  msg: PushMessage,
): Promise<{ delivered: boolean; error?: string }> {
  const userDevices = await db.select().from(devices).where(eq(devices.userId, userId));
  if (userDevices.length === 0) return { delivered: false, error: "no devices" };

  let delivered = false;
  let lastError: string | undefined;

  const expoTokens = userDevices.filter((d) => d.provider === "expo").map((d) => d.fcmToken);
  if (expoTokens.length > 0) {
    const r = await sendExpoPush(expoTokens, msg);
    if (r.ok) delivered = true;
    else lastError = r.error;
    await pruneDeadDevices(r.deadTokens);
  }

  const fcmTokens = userDevices.filter((d) => d.provider === "fcm").map((d) => d.fcmToken);
  if (fcmTokens.length > 0) {
    if (!fcmConfigured()) {
      lastError = "FCM not configured";
    } else {
      for (const token of fcmTokens) {
        const r = await sendFcmPush(token, msg);
        if (r.ok) delivered = true;
        else lastError = r.error;
        await pruneDeadDevices(r.deadTokens);
      }
    }
  }

  if (delivered) {
    await db.update(devices).set({ lastActiveAt: new Date() }).where(eq(devices.userId, userId));
  }
  return { delivered, error: lastError };
}

async function pruneDeadDevices(deadTokens: string[]) {
  for (const token of deadTokens) {
    await db.delete(devices).where(eq(devices.fcmToken, token));
    log.info({ token: `${token.slice(0, 12)}…` }, "removed dead push token");
  }
}
