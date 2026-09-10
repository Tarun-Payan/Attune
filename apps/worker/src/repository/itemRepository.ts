import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@attune/db/client";
import { clusters, itemTopics, items, topics } from "@attune/db/schema";

export interface InsertItemInput {
  sourceId: string;
  externalId: string;
  url: string;
  urlHash: string;
  title: string;
  content: string;
  author: string | null;
  imageUrl: string | null;
  metrics: Record<string, number>;
  publishedAt: Date;
}

export interface InsertedItemResult {
  id: string;
  urlHash: string;
  title: string;
  content: string;
}

export interface ItemWithTopicKeys {
  itemId: string;
  title: string;
  metrics: Record<string, number> | null;
  topicKeys: string[];
}

export interface UnsummarizedItem {
  id: string;
  title: string;
  content: string;
}

export interface UnclusteredPair {
  aid: string;
  atitle: string;
  bid: string;
  btitle: string;
}

export interface UntaggedItem {
  id: string;
  title: string;
  content: string;
}

export async function batchInsertItems(rows: InsertItemInput[]): Promise<InsertedItemResult[]> {
  const inserted: InsertedItemResult[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const ret = await db
      .insert(items)
      .values(chunk)
      .onConflictDoNothing()
      .returning({
        id: items.id,
        urlHash: items.urlHash,
        title: items.title,
        content: items.content,
      });
    inserted.push(...ret);
  }
  return inserted;
}

export async function countRecentAiSummaries(): Promise<number> {
  const rows = (await db.execute(
    sql`SELECT count(*) AS n FROM items WHERE summary IS NOT NULL AND created_at > now() - interval '24 hours'`,
  )) as unknown as { n: string }[];
  return Number(rows[0]?.n ?? 0);
}

export async function findUnsummarizedHottestItems(limit: number): Promise<UnsummarizedItem[]> {
  const rows = (await db.execute(sql`
    SELECT i.id, i.title, i.content
    FROM items i
    WHERE i.summary IS NULL
      AND i.hidden = false
      AND i.created_at > now() - interval '48 hours'
      AND greatest(
            coalesce(i.metrics->>'points','0')::float8,
            coalesce(i.metrics->>'score','0')::float8,
            coalesce(i.metrics->>'stars','0')::float8,
            coalesce(i.metrics->>'likes','0')::float8,
            coalesce(i.metrics->>'views','0')::float8 / 100.0,
            0
          ) > 30
    ORDER BY greatest(
              coalesce(i.metrics->>'points','0')::float8,
              coalesce(i.metrics->>'score','0')::float8,
              coalesce(i.metrics->>'stars','0')::float8,
              coalesce(i.metrics->>'likes','0')::float8,
              coalesce(i.metrics->>'views','0')::float8 / 100.0,
              0
            ) DESC
    LIMIT ${limit}
  `)) as unknown as UnsummarizedItem[];
  return rows;
}

export async function updateItemSummary(id: string, summary: string): Promise<void> {
  await db.execute(
    sql`UPDATE items SET summary = ${summary.slice(0, 500)} WHERE id = ${id}`,
  );
}

export async function attachItemsToClusters(similarityThreshold: number): Promise<number> {
  const attached = await db.execute(sql`
    WITH matches AS (
      SELECT DISTINCT ON (i.id) i.id AS item_id, j.cluster_id AS cluster_id
      FROM items i
      JOIN items j
        ON j.cluster_id IS NOT NULL
       AND j.id != i.id
       AND j.source_id != i.source_id
       AND j.published_at > now() - interval '48 hours'
       AND similarity(i.title, j.title) > ${similarityThreshold}
      WHERE i.cluster_id IS NULL
        AND i.published_at > now() - interval '48 hours'
      ORDER BY i.id, similarity(i.title, j.title) DESC
    )
    UPDATE items SET cluster_id = matches.cluster_id
    FROM matches WHERE items.id = matches.item_id
  `);
  return Number((attached as unknown as { count?: number }).count ?? 0);
}

export async function findUnclusteredPairs(
  similarityThreshold: number,
  limit = 100,
): Promise<UnclusteredPair[]> {
  const pairs = (await db.execute(sql`
    SELECT DISTINCT ON (a.id) a.id AS aid, a.title AS atitle, b.id AS bid, b.title AS btitle
    FROM items a
    JOIN items b
      ON a.id < b.id
     AND a.source_id != b.source_id
     AND a.cluster_id IS NULL AND b.cluster_id IS NULL
     AND a.published_at > now() - interval '48 hours'
     AND b.published_at > now() - interval '48 hours'
     AND similarity(a.title, b.title) > ${similarityThreshold}
    ORDER BY a.id, similarity(a.title, b.title) DESC
    LIMIT ${limit}
  `)) as unknown as UnclusteredPair[];
  return pairs;
}

export async function findClusterStateForPair(
  aid: string,
  bid: string,
): Promise<{ aCluster: string | null; bCluster: string | null } | undefined> {
  const fresh = (await db.execute(sql`
    SELECT a.cluster_id AS a_cluster, b.cluster_id AS b_cluster
    FROM (SELECT cluster_id FROM items WHERE id = ${aid}) a,
         (SELECT cluster_id FROM items WHERE id = ${bid}) b
  `)) as unknown as { a_cluster: string | null; b_cluster: string | null }[];

  const state = fresh[0];
  if (!state) return undefined;
  return { aCluster: state.a_cluster, bCluster: state.b_cluster };
}

export async function createCluster(title: string): Promise<string> {
  const [cluster] = await db
    .insert(clusters)
    .values({ title })
    .returning({ id: clusters.id });
  return cluster.id;
}

export async function updateItemCluster(itemIds: string[], clusterId: string): Promise<void> {
  if (itemIds.length === 0) return;
  await db
    .update(items)
    .set({ clusterId })
    .where(inArray(items.id, itemIds));
}

export async function findUntaggedOrphanItems(
  cutoff: Date,
  limit = 200,
): Promise<UntaggedItem[]> {
  return db
    .select({ id: items.id, title: items.title, content: items.content })
    .from(items)
    .leftJoin(itemTopics, eq(itemTopics.itemId, items.id))
    .where(and(isNull(itemTopics.itemId), gt(items.createdAt, cutoff)))
    .limit(limit);
}

export async function findItemsWithTopicsByIds(itemIds: string[]): Promise<ItemWithTopicKeys[]> {
  if (itemIds.length === 0) return [];
  const rows = await db
    .select({
      itemId: items.id,
      title: items.title,
      metrics: items.metrics,
      topicKeys: sql<string[]>`array_agg(distinct ${topics.key})`,
    })
    .from(items)
    .innerJoin(itemTopics, eq(itemTopics.itemId, items.id))
    .innerJoin(topics, eq(topics.id, itemTopics.topicId))
    .where(and(inArray(items.id, itemIds), eq(items.hidden, false)))
    .groupBy(items.id);
  return rows;
}
