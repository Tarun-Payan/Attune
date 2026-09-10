import { and, eq, sql } from "drizzle-orm";
import { db } from "@attune/db/client";
import { devices, inAppNotifications, notificationLogs, notificationPrefs, users } from "@attune/db/schema";
import type { DevicePlatform, DeviceProvider, NotificationChannel, NotificationKind, NotificationStatus } from "@attune/types";
import { sendInAppNotification, type InAppNotificationInput } from "@attune/notifications";

export interface UpdateNotificationPrefsData {
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  maxPushPerHour?: number;
}

export interface RegisterDeviceData {
  userId: string;
  token: string;
  platform: DevicePlatform;
  provider?: DeviceProvider;
}

export interface LogNotificationData {
  userId: string;
  itemId?: string | null;
  channel: NotificationChannel;
  kind: NotificationKind;
  status: NotificationStatus;
  error?: string | null;
}

export async function ensureNotificationPrefs(userId: string) {
  await db.insert(notificationPrefs).values({ userId }).onConflictDoNothing();
  const [prefs] = await db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, userId));
  return prefs;
}

export async function getNotificationPrefs(userId: string) {
  const [prefs] = await db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, userId));
  return prefs;
}

export async function updateNotificationPrefs(userId: string, data: UpdateNotificationPrefsData) {
  await ensureNotificationPrefs(userId);
  const [updated] = await db
    .update(notificationPrefs)
    .set(data)
    .where(eq(notificationPrefs.userId, userId))
    .returning();
  return updated;
}

export async function registerDevice(data: RegisterDeviceData) {
  const [device] = await db
    .insert(devices)
    .values({
      userId: data.userId,
      fcmToken: data.token,
      platform: data.platform,
      provider: data.provider ?? "expo",
    })
    .onConflictDoUpdate({
      target: devices.fcmToken,
      set: {
        userId: data.userId,
        platform: data.platform,
        provider: data.provider ?? "expo",
        lastActiveAt: new Date(),
      },
    })
    .returning({ id: devices.id });
  return device;
}

export async function removeDevice(userId: string, deviceId: string) {
  const deleted = await db
    .delete(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
    .returning({ id: devices.id });
  return deleted.length > 0;
}

export async function getUserDevices(userId: string) {
  return db.select().from(devices).where(eq(devices.userId, userId));
}

export async function logNotification(data: LogNotificationData) {
  const [created] = await db
    .insert(notificationLogs)
    .values({
      userId: data.userId,
      itemId: data.itemId ?? null,
      channel: data.channel,
      kind: data.kind,
      status: data.status,
      error: data.error ?? null,
    })
    .returning();
  return created;
}

export async function listCampaignLogs(limit = 25, offset = 0) {
  const [rowsResult, countResult] = await Promise.all([
    db.execute(sql`
      SELECT nl.id, u.email, nl.channel, nl.status, nl.error, nl.sent_at AS "sentAt"
      FROM notification_logs nl
      JOIN users u ON u.id = nl.user_id
      WHERE nl.kind = 'campaign'
      ORDER BY nl.sent_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
    db.execute(sql`
      SELECT count(*) AS total
      FROM notification_logs nl
      WHERE nl.kind = 'campaign'
    `),
  ]);

  const rows = rowsResult as unknown as {
    id: string;
    email: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    error: string | null;
    sentAt: string;
  }[];

  const total = Number((countResult as unknown as { total: string | number }[])[0]?.total ?? 0);

  return {
    sends: rows,
    total,
  };
}

export type CreateInAppNotificationData = InAppNotificationInput;

export async function createInAppNotification(data: CreateInAppNotificationData) {
  return sendInAppNotification(data);
}

export async function listInAppNotifications(userId: string, limit = 20, offset = 0) {
  const [countRow] = await db
    .select({
      total: sql<number>`count(*)`,
      unread: sql<number>`count(*) FILTER (WHERE read_at IS NULL)`,
    })
    .from(inAppNotifications)
    .where(eq(inAppNotifications.userId, userId));

  const rows = await db
    .select()
    .from(inAppNotifications)
    .where(eq(inAppNotifications.userId, userId))
    .orderBy(sql`${inAppNotifications.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  return {
    count: Number(countRow?.total ?? 0),
    unreadCount: Number(countRow?.unread ?? 0),
    notifications: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      itemId: r.itemId,
      title: r.title,
      body: r.body,
      kind: r.kind,
      data: r.data as Record<string, unknown> | null,
      readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
  };
}

export async function markInAppNotificationRead(userId: string, id: string) {
  const [updated] = await db
    .update(inAppNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, userId)))
    .returning({ id: inAppNotifications.id });

  return Boolean(updated);
}

export async function markAllInAppNotificationsRead(userId: string): Promise<number> {
  const updated = await db
    .update(inAppNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(inAppNotifications.userId, userId), sql`${inAppNotifications.readAt} IS NULL`))
    .returning({ id: inAppNotifications.id });

  return updated.length;
}
