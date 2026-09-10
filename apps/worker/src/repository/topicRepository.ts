import { and, eq, inArray } from "drizzle-orm";
import { db } from "@attune/db/client";
import { itemTags, itemTopics, tags, topics, userTopics } from "@attune/db/schema";

export interface ItemTopicLink {
  itemId: string;
  topicId: string;
  confidence: number;
  method: string;
}

export interface ItemTagLink {
  itemId: string;
  tagId: string;
}

export interface UserTopicSubscription {
  userId: string;
  topicKey: string;
}

export async function getAllTopics(): Promise<{ id: string; key: string }[]> {
  return db.select({ id: topics.id, key: topics.key }).from(topics);
}

export async function getTopicIdByKeyMap(): Promise<Map<string, string>> {
  const rows = await getAllTopics();
  return new Map(rows.map((t) => [t.key, t.id]));
}

export async function batchLinkItemTopics(links: ItemTopicLink[]): Promise<void> {
  if (links.length === 0) return;
  await db.insert(itemTopics).values(links).onConflictDoNothing();
}

export async function getAllTags(): Promise<{ id: string; key: string }[]> {
  return db.select({ id: tags.id, key: tags.key }).from(tags);
}

export async function getTagIdByKeyMap(): Promise<Map<string, string>> {
  const rows = await getAllTags();
  return new Map(rows.map((t) => [t.key, t.id]));
}

export async function batchLinkItemTags(links: ItemTagLink[]): Promise<void> {
  if (links.length === 0) return;
  await db.insert(itemTags).values(links).onConflictDoNothing();
}

export async function findSubscribersForTopics(topicKeys: string[]): Promise<UserTopicSubscription[]> {
  if (topicKeys.length === 0) return [];
  return db
    .selectDistinct({ userId: userTopics.userId, topicKey: topics.key })
    .from(userTopics)
    .innerJoin(topics, eq(topics.id, userTopics.topicId))
    .where(and(inArray(topics.key, topicKeys), eq(userTopics.notify, true)));
}

