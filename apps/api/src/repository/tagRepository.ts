import { eq, sql } from "drizzle-orm";
import { db } from "@attune/db/client";
import { itemTags, tags, topics, userTags, type Tag } from "@attune/db/schema";
import type { AdminTagRow } from "@attune/types";

export interface CreateTagData {
  key: string;
  name: string;
  topicId?: string | null;
}

export interface UpdateTagData {
  name?: string;
  topicId?: string | null;
}

export async function listTags(topicId?: string): Promise<Tag[]> {
  const query = db.select().from(tags);
  if (topicId) {
    return query.where(eq(tags.topicId, topicId)).orderBy(tags.name);
  }
  return query.orderBy(tags.name);
}

export async function findTagById(id: string): Promise<Tag | undefined> {
  const [tag] = await db.select().from(tags).where(eq(tags.id, id));
  return tag;
}

export async function findTagByKey(key: string): Promise<Tag | undefined> {
  const [tag] = await db.select().from(tags).where(eq(tags.key, key));
  return tag;
}

export async function createTag(data: CreateTagData): Promise<Tag | undefined> {
  const [created] = await db
    .insert(tags)
    .values({
      key: data.key,
      name: data.name,
      topicId: data.topicId ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return created;
}

export async function updateTag(id: string, data: UpdateTagData): Promise<Tag | undefined> {
  const [updated] = await db
    .update(tags)
    .set(data)
    .where(eq(tags.id, id))
    .returning();
  return updated;
}

export async function deleteTag(id: string): Promise<boolean> {
  await db.delete(itemTags).where(eq(itemTags.tagId, id));
  await db.delete(userTags).where(eq(userTags.tagId, id));
  const deleted = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
  return deleted.length > 0;
}

export async function listAdminTags(): Promise<AdminTagRow[]> {
  const rows = await db
    .select({
      id: tags.id,
      key: tags.key,
      name: tags.name,
      topicId: tags.topicId,
      createdAt: tags.createdAt,
      topicName: topics.name,
      itemCount: sql<number>`(SELECT count(*) FROM item_tags it WHERE it.tag_id = ${tags.id})`,
    })
    .from(tags)
    .leftJoin(topics, eq(topics.id, tags.topicId))
    .orderBy(tags.name);

  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    topicId: r.topicId,
    topicName: r.topicName,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
    itemCount: Number(r.itemCount ?? 0),
  }));
}

export async function getItemTagKeys(itemId: string): Promise<string[]> {
  const rows = await db
    .select({ key: tags.key })
    .from(itemTags)
    .innerJoin(tags, eq(tags.id, itemTags.tagId))
    .where(eq(itemTags.itemId, itemId));

  return rows.map((r) => r.key);
}
