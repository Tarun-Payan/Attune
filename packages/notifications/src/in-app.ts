import { db, inAppNotifications } from "@attune/db";
import type { InAppNotificationInput } from "./types";

/**
 * Persists an in-app notification directly into PostgreSQL.
 * Guaranteed delivery to the user's mobile/web notifications inbox regardless of push status.
 */
export async function sendInAppNotification(input: InAppNotificationInput) {
  const [created] = await db
    .insert(inAppNotifications)
    .values({
      userId: input.userId,
      itemId: input.itemId ?? null,
      title: input.title,
      body: input.body,
      kind: input.kind ?? "topic_match",
      data: input.data ?? null,
    })
    .returning();

  return created;
}

/**
 * Bulk persists in-app notifications for multiple recipients in a single SQL insert.
 */
export async function sendBulkInAppNotifications(inputs: InAppNotificationInput[]) {
  if (inputs.length === 0) return [];

  const values = inputs.map((input) => ({
    userId: input.userId,
    itemId: input.itemId ?? null,
    title: input.title,
    body: input.body,
    kind: input.kind ?? "topic_match",
    data: input.data ?? null,
  }));

  return db.insert(inAppNotifications).values(values).returning();
}
