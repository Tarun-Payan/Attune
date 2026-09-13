import { eq, sql } from "drizzle-orm";
import { db } from "@attune/db/client";
import { itemTopics, topics, userTopics, type Topic } from "@attune/db/schema";
import type { AdminTopicRow, UserPreference } from "@attune/types";

export interface CreateTopicData {
  key: string;
  name: string;
  icon?: string | null;
  parentId?: string | null;
}

export interface UpdateTopicData {
  name?: string;
  icon?: string | null;
}

export async function listTopics(): Promise<Topic[]> {
  return db.select().from(topics).orderBy(topics.name);
}

export async function findTopicById(id: string): Promise<Topic | undefined> {
  const [topic] = await db.select().from(topics).where(eq(topics.id, id));
  return topic;
}

export async function findTopicByKey(key: string): Promise<Topic | undefined> {
  const [topic] = await db.select().from(topics).where(eq(topics.key, key));
  return topic;
}

export async function createTopic(data: CreateTopicData): Promise<Topic | undefined> {
  const [created] = await db
    .insert(topics)
    .values({
      key: data.key,
      name: data.name,
      icon: data.icon ?? null,
      parentId: data.parentId ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return created;
}

export async function updateTopic(id: string, data: UpdateTopicData): Promise<Topic | undefined> {
  const [updated] = await db
    .update(topics)
    .set(data)
    .where(eq(topics.id, id))
    .returning();
  return updated;
}

export async function deleteTopic(id: string): Promise<boolean> {
  await db.delete(itemTopics).where(eq(itemTopics.topicId, id));
  await db.delete(userTopics).where(eq(userTopics.topicId, id));
  const deleted = await db.delete(topics).where(eq(topics.id, id)).returning({ id: topics.id });
  return deleted.length > 0;
}

export async function listAdminTopics(): Promise<AdminTopicRow[]> {
  const rows = await db
    .select({
      id: topics.id,
      key: topics.key,
      name: topics.name,
      icon: topics.icon,
      itemTotal: sql<number>`(SELECT count(*) FROM item_topics it WHERE it.topic_id = "topics"."id")`,
      itemWeek: sql<number>`(SELECT count(*) FROM item_topics it JOIN items i ON i.id = it.item_id WHERE it.topic_id = "topics"."id" AND i.published_at > now() - interval '7 days')`,
      followers: sql<number>`(SELECT count(*) FROM user_topics ut WHERE ut.topic_id = "topics"."id")`,
      tagCount: sql<number>`(SELECT count(*) FROM tags tg WHERE tg.topic_id = "topics"."id")`,
    })
    .from(topics)
    .orderBy(topics.name);

  return rows.map((r) => ({
    ...r,
    itemTotal: Number(r.itemTotal ?? 0),
    itemWeek: Number(r.itemWeek ?? 0),
    followers: Number(r.followers ?? 0),
    tagCount: Number(r.tagCount ?? 0),
  }));
}

export async function getUserTopicPreferences(userId: string): Promise<UserPreference[]> {
  const rows = await db
    .select({
      key: topics.key,
      name: topics.name,
      icon: topics.icon,
      notify: userTopics.notify,
      weight: userTopics.weight,
    })
    .from(userTopics)
    .innerJoin(topics, eq(topics.id, userTopics.topicId))
    .where(eq(userTopics.userId, userId));

  return rows.map((r) => ({
    ...r,
    weight: Number(r.weight ?? 1.0),
  }));
}

export async function setUserTopicPreferences(
  userId: string,
  preferences: { key: string; notify: boolean }[],
): Promise<UserPreference[]> {
  const keys = [...new Set(preferences.map((t) => t.key))];
  const known = await db.select({ id: topics.id, key: topics.key }).from(topics);
  const idByKey = new Map(known.map((t) => [t.key, t.id]));

  const unknown = keys.filter((k) => !idByKey.has(k));
  if (unknown.length > 0) {
    throw new Error(`Unknown topic keys: ${unknown.join(", ")}`);
  }

  await db.transaction(async (tx) => {
    await tx.delete(userTopics).where(eq(userTopics.userId, userId));
    if (preferences.length > 0) {
      await tx.insert(userTopics).values(
        preferences.map((t) => ({
          userId,
          topicId: idByKey.get(t.key)!,
          notify: t.notify,
        })),
      );
    }
  });

  return getUserTopicPreferences(userId);
}
