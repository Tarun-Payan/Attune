import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@attune/db/client";
import { sendInAppNotification } from "@attune/notifications";
import {
  inAppNotifications,
  notificationLogs,
  notificationPrefs,
  topics,
  userTopics,
  users,
  type User,
} from "@attune/db/schema";

export type NotificationPrefRow = typeof notificationPrefs.$inferSelect;

export interface UserWithNotificationPrefs {
  user: User;
  prefs: NotificationPrefRow;
}

export interface CreateNotificationLogInput {
  userId: string;
  itemId?: string | null;
  channel: "push" | "email";
  kind: string;
  status: string;
  error?: string | null;
}

export interface CreateInAppNotificationInput {
  userId: string;
  itemId?: string | null;
  title: string;
  body: string;
  kind?: string;
  data?: Record<string, unknown>;
}

export async function findUsersWithNotificationPrefs(): Promise<UserWithNotificationPrefs[]> {
  return db
    .select({ user: users, prefs: notificationPrefs })
    .from(users)
    .innerJoin(notificationPrefs, eq(notificationPrefs.userId, users.id));
}

export async function createNotificationLog(data: CreateNotificationLogInput): Promise<void> {
  await db.insert(notificationLogs).values({
    userId: data.userId,
    itemId: data.itemId ?? null,
    channel: data.channel,
    kind: data.kind,
    status: data.status,
    error: data.error ?? null,
  });
}

export async function createInAppNotification(data: CreateInAppNotificationInput): Promise<void> {
  await sendInAppNotification(data);
}

export async function findCampaignAudience(
  topicKey?: string,
  userIds?: string[],
): Promise<{ id: string; email: string }[]> {
  if (userIds && userIds.length > 0) {
    return db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(inArray(users.id, userIds), isNull(users.disabledAt)));
  }

  if (topicKey) {
    return db
      .select({ id: users.id, email: users.email })
      .from(users)
      .innerJoin(userTopics, eq(userTopics.userId, users.id))
      .innerJoin(topics, eq(topics.id, userTopics.topicId))
      .where(and(eq(topics.key, topicKey), isNull(users.disabledAt)));
  }

  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(isNull(users.disabledAt));
}

export async function getUserById(userId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user;
}

export async function getUserNotificationPrefs(userId: string): Promise<NotificationPrefRow | undefined> {
  const [prefs] = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userId, userId));
  return prefs;
}

export async function getRecentSentTopicPushes(userId: string, since: Date): Promise<{ sentAt: Date }[]> {
  return db
    .select({ sentAt: notificationLogs.sentAt })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.userId, userId),
        eq(notificationLogs.channel, "push"),
        eq(notificationLogs.kind, "topic_match"),
        eq(notificationLogs.status, "sent"),
        gte(notificationLogs.sentAt, since),
      ),
    );
}
