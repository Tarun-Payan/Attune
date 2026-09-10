import { eq, sql } from "drizzle-orm";
import { db } from "@attune/db/client";
import { items, itemTags, itemTopics, reports, sources, tags, topics } from "@attune/db/schema";
import type { CursorPayload, FeedItem } from "@attune/types";
import { getUserItemState } from "./interactionRepository";

export interface FeedQueryParams {
  userId: string;
  limit: number;
  topicKeys?: string[] | null;
  cursor?: CursorPayload | null;
}

export interface AdminItemFilters {
  q?: string;
  topic?: string;
  sourceId?: string;
  hidden?: "true" | "false";
  reported?: "true" | "false";
  limit: number;
  offset: number;
}

interface RawFeedRow {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  author: string | null;
  metrics: Record<string, number> | null;
  published_at: Date | string;
  source_name: string;
  topic_keys: string[] | null;
  tag_keys: string[] | null;
  cluster_size: number;
  likes_count: number;
  views_count: number;
  dislikes_count: number;
  reports_count: number;
  score: number;
}

interface RawSearchRow {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  author: string | null;
  metrics: Record<string, number> | null;
  published_at: Date;
  source_name: string;
  topic_keys: string[] | null;
  tag_keys: string[] | null;
  likes_count: number;
  views_count: number;
}

export async function findItemById(id: string) {
  const [row] = await db
    .select({
      id: items.id,
      title: items.title,
      summary: items.summary,
      content: items.content,
      url: items.url,
      imageUrl: items.imageUrl,
      author: items.author,
      metrics: items.metrics,
      language: items.language,
      publishedAt: items.publishedAt,
      clusterId: items.clusterId,
      hidden: items.hidden,
      likesCount: items.likesCount,
      dislikesCount: items.dislikesCount,
      viewsCount: items.viewsCount,
      reportsCount: items.reportsCount,
      sourceName: sources.name,
      sourceCredibility: sources.credibility,
    })
    .from(items)
    .innerJoin(sources, eq(sources.id, items.sourceId))
    .where(eq(items.id, id));

  return row;
}

export async function getItemTopics(itemId: string) {
  return db
    .select({
      key: topics.key,
      name: topics.name,
      icon: topics.icon,
      confidence: itemTopics.confidence,
    })
    .from(itemTopics)
    .innerJoin(topics, eq(topics.id, itemTopics.topicId))
    .where(eq(itemTopics.itemId, itemId));
}

export async function findPersonalizedFeed(params: FeedQueryParams): Promise<{ items: FeedItem[]; rawScores: { id: string; score: number }[] }> {
  const { userId, limit, topicKeys, cursor } = params;
  const refTime = cursor ? new Date(cursor.t) : new Date();
  const refTimeIso = refTime.toISOString();
  const topicsCond =
    topicKeys && topicKeys.length > 0
      ? sql`AND t.key IN (${sql.join(
          topicKeys.map((k) => sql`${k}`),
          sql`, `,
        )})`
      : sql``;
  const cursorCond = cursor
    ? sql`AND (s.score < ${cursor.s} OR (s.score = ${cursor.s} AND s.id < ${cursor.id}))`
    : sql``;

  // Decide how many personal items vs exploration items (e.g. 10% exploration if no specific topic filter)
  const isFiltered = Boolean(topicKeys && topicKeys.length > 0);
  const explorationCount = isFiltered ? 0 : Math.max(1, Math.round(limit * 0.1));
  const personalLimit = limit - explorationCount;

  // 1. Personalized pool query
  const result = await db.execute(sql`
    WITH scored AS (
      SELECT
        i.id, i.title, i.summary, i.url, i.image_url, i.author, i.metrics, i.published_at,
        i.likes_count, i.views_count, i.dislikes_count, i.reports_count,
        src.name AS source_name,
        (
          SELECT array_agg(DISTINCT tk.key)
          FROM item_topics itx JOIN topics tk ON tk.id = itx.topic_id
          WHERE itx.item_id = i.id
        ) AS topic_keys,
        (
          SELECT array_agg(DISTINCT tg.key)
          FROM item_tags itg JOIN tags tg ON tg.id = itg.tag_id
          WHERE itg.item_id = i.id
        ) AS tag_keys,
        coalesce((SELECT count(*) FROM items c WHERE c.cluster_id = i.cluster_id), 1) AS cluster_size,
        round((
          0.35 * exp(-0.0577627 * extract(epoch FROM (${refTimeIso}::timestamptz - i.published_at)) / 3600.0)
          + 0.20 * least(1.0, ln(1.0 + greatest(
              coalesce(i.metrics->>'points','0')::float8,
              coalesce(i.metrics->>'score','0')::float8,
              coalesce(i.metrics->>'stars','0')::float8,
              coalesce(i.likes_count, 0)::float8 * 5.0,
              coalesce(i.views_count, 0)::float8 / 50.0,
              coalesce(i.metrics->>'comments','0')::float8 / 5.0
            )) / ln(3000.0))
          + 0.15 * (src.credibility::float8 / 5.0)
          + 0.15 * least(3.0, coalesce(max(ut.weight), 1.0)) / 3.0
          + 0.10 * least(3.0, coalesce((
              SELECT coalesce(sum(utg.weight), 0.0)
              FROM item_tags itgx
              JOIN user_tags utg ON utg.tag_id = itgx.tag_id AND utg.user_id = ${userId}
              WHERE itgx.item_id = i.id
            ), 0.0)) / 3.0
          + 0.05 * least(1.0, coalesce((SELECT count(*) FROM items c WHERE c.cluster_id = i.cluster_id), 1)::float8 / 4.0)
        )::numeric, 6)::float8 AS score
      FROM items i
      JOIN sources src ON src.id = i.source_id
      LEFT JOIN item_topics it ON it.item_id = i.id
      LEFT JOIN topics t ON t.id = it.topic_id
      LEFT JOIN user_topics ut ON ut.topic_id = it.topic_id AND ut.user_id = ${userId}
      WHERE i.hidden = false
        AND i.published_at > ${refTimeIso}::timestamptz - interval '14 days'
        AND NOT EXISTS (
          SELECT 1 FROM interactions ix
          WHERE ix.user_id = ${userId}
            AND ix.item_id = i.id
            AND ix.type IN ('DISLIKE', 'REPORT', 'HIDE')
        )
        ${topicsCond}
      GROUP BY i.id, src.name, src.credibility
    )
    SELECT s.* FROM scored s
    WHERE true ${cursorCond}
    ORDER BY s.score DESC, s.id DESC
    LIMIT ${personalLimit}
  `);

  const personalRows = result as unknown as RawFeedRow[];
  const existingIds = new Set(personalRows.map((r) => r.id));

  // 2. Exploration pool (items outside user's top engagement, high quality trending)
  let explorationRows: RawFeedRow[] = [];
  if (explorationCount > 0 && !cursor) {
    const exploreResult = await db.execute(sql`
      SELECT
        i.id, i.title, i.summary, i.url, i.image_url, i.author, i.metrics, i.published_at,
        i.likes_count, i.views_count, i.dislikes_count, i.reports_count,
        src.name AS source_name,
        (
          SELECT array_agg(DISTINCT tk.key)
          FROM item_topics itx JOIN topics tk ON tk.id = itx.topic_id
          WHERE itx.item_id = i.id
        ) AS topic_keys,
        (
          SELECT array_agg(DISTINCT tg.key)
          FROM item_tags itg JOIN tags tg ON tg.id = itg.tag_id
          WHERE itg.item_id = i.id
        ) AS tag_keys,
        coalesce((SELECT count(*) FROM items c WHERE c.cluster_id = i.cluster_id), 1) AS cluster_size,
        0.5::float8 AS score
      FROM items i
      JOIN sources src ON src.id = i.source_id
      WHERE i.hidden = false
        AND i.published_at > ${refTimeIso}::timestamptz - interval '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM interactions ix
          WHERE ix.user_id = ${userId}
            AND ix.item_id = i.id
            AND ix.type IN ('DISLIKE', 'REPORT', 'HIDE')
        )
        AND NOT EXISTS (
          SELECT 1 FROM item_topics it
          JOIN user_topics ut ON ut.topic_id = it.topic_id AND ut.user_id = ${userId}
          WHERE it.item_id = i.id AND ut.weight >= 1.5
        )
      ORDER BY src.credibility DESC, i.likes_count DESC, i.published_at DESC
      LIMIT ${explorationCount * 3}
    `);

    const rawExplore = exploreResult as unknown as RawFeedRow[];
    explorationRows = rawExplore.filter((r) => !existingIds.has(r.id)).slice(0, explorationCount);
  }

  // Interleave exploration items into slots (e.g. index 6 and 14)
  const combinedRows: { row: RawFeedRow; isExplore: boolean }[] = personalRows.map((row) => ({
    row,
    isExplore: false,
  }));

  if (explorationRows.length > 0) {
    if (explorationRows[0]) {
      const slot = Math.min(6, combinedRows.length);
      combinedRows.splice(slot, 0, { row: explorationRows[0], isExplore: true });
    }
    if (explorationRows[1]) {
      const slot = Math.min(14, combinedRows.length);
      combinedRows.splice(slot, 0, { row: explorationRows[1], isExplore: true });
    }
  }

  // Fetch user interaction states (liked, disliked, saved)
  const allIds = combinedRows.map((c) => c.row.id);
  const userStates = await getUserItemState(userId, allIds);

  const feedItems: FeedItem[] = combinedRows.map(({ row: r, isExplore }) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    url: r.url,
    imageUrl: r.image_url,
    author: r.author,
    metrics: r.metrics,
    publishedAt: typeof r.published_at === "string" ? r.published_at : new Date(r.published_at).toISOString(),
    source: { name: r.source_name },
    topics: r.topic_keys ?? [],
    tags: r.tag_keys ?? [],
    clusterSize: Number(r.cluster_size ?? 1),
    score: r.score,
    likesCount: Number(r.likes_count ?? 0),
    dislikesCount: Number(r.dislikes_count ?? 0),
    viewsCount: Number(r.views_count ?? 0),
    reportsCount: Number(r.reports_count ?? 0),
    userState: userStates.get(r.id) ?? { liked: false, disliked: false, saved: false },
    isExploration: isExplore,
  }));

  const rawScores = personalRows.map((r) => ({ id: r.id, score: r.score }));

  return { items: feedItems, rawScores };
}

export async function searchItems(q: string, limit: number) {
  const rows = (await db.execute(sql`
    SELECT i.id, i.title, i.summary, i.url, i.image_url, i.author, i.metrics, i.published_at,
           i.likes_count, i.views_count,
           src.name AS source_name,
           coalesce((SELECT array_agg(tx.key) FROM item_topics itx JOIN topics tx ON tx.id = itx.topic_id WHERE itx.item_id = i.id), '{}') AS topic_keys,
           coalesce((SELECT array_agg(tg.key) FROM item_tags itg JOIN tags tg ON tg.id = itg.tag_id WHERE itg.item_id = i.id), '{}') AS tag_keys
    FROM items i
    JOIN sources src ON src.id = i.source_id
    WHERE i.hidden = false
      AND i.published_at > now() - interval '30 days'
      AND (
        i.title ILIKE ${`%${q}%`}
        OR to_tsvector('english', coalesce(i.title,'') || ' ' || coalesce(i.content,''))
            @@ websearch_to_tsquery('english', ${q})
      )
    ORDER BY ts_rank(
              to_tsvector('english', coalesce(i.title,'') || ' ' || coalesce(i.content,'')),
              websearch_to_tsquery('english', ${q})
            ) DESC,
            i.published_at DESC
    LIMIT ${limit}
  `)) as unknown as RawSearchRow[];

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    url: r.url,
    imageUrl: r.image_url,
    author: r.author,
    metrics: r.metrics,
    publishedAt: typeof r.published_at === "string" ? r.published_at : new Date(r.published_at).toISOString(),
    source: { name: r.source_name },
    topics: r.topic_keys ?? [],
    tags: r.tag_keys ?? [],
    likesCount: Number(r.likes_count ?? 0),
    viewsCount: Number(r.views_count ?? 0),
  }));
}

export async function findSavedItems(userId: string, limit = 100) {
  const result = await db.execute(sql`
    SELECT s.id, s.title, s.url, s.image_url, s.published_at, s.saved_at
    FROM (
      SELECT i.id, i.title, i.url, i.image_url, i.published_at,
             max(it.created_at) AS saved_at
      FROM interactions it
      JOIN items i ON i.id = it.item_id
      WHERE it.user_id = ${userId} AND it.type = 'SAVE'
      GROUP BY i.id
    ) s
    ORDER BY s.saved_at DESC
    LIMIT ${limit}
  `);

  const rows = result as unknown as {
    id: string;
    title: string;
    url: string;
    image_url: string | null;
    published_at: Date | string;
    saved_at: Date | string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    imageUrl: r.image_url,
    publishedAt: typeof r.published_at === "string" ? r.published_at : new Date(r.published_at).toISOString(),
    savedAt: typeof r.saved_at === "string" ? r.saved_at : new Date(r.saved_at).toISOString(),
  }));
}

export async function listAdminItems(filters: AdminItemFilters) {
  const { q, topic, sourceId, hidden, reported, limit, offset } = filters;

  const sqlFilters = [sql`true`];
  if (q) sqlFilters.push(sql`(i.title ILIKE ${`%${q}%`} OR i.url ILIKE ${`%${q}%`})`);
  if (topic) {
    sqlFilters.push(
      sql`EXISTS (SELECT 1 FROM item_topics itx JOIN topics tx ON tx.id = itx.topic_id WHERE itx.item_id = i.id AND tx.key = ${topic})`,
    );
  }
  if (sourceId) sqlFilters.push(sql`i.source_id = ${sourceId}`);
  if (hidden === "true") sqlFilters.push(sql`i.hidden = true`);
  if (hidden === "false") sqlFilters.push(sql`i.hidden = false`);
  if (reported === "true") sqlFilters.push(sql`i.reports_count > 0`);

  const whereClause = sql.join(sqlFilters, sql` AND `);

  const [rowsResult, countResult] = await Promise.all([
    db.execute(sql`
      SELECT i.id, i.title, i.url, i.author, i.metrics, i.hidden, i.published_at, i.created_at,
             i.likes_count, i.dislikes_count, i.views_count, i.reports_count,
             s.name AS source_name,
             coalesce((SELECT array_agg(tx.key) FROM item_topics itx JOIN topics tx ON tx.id = itx.topic_id WHERE itx.item_id = i.id), '{}') AS topic_keys,
             coalesce((SELECT array_agg(tg.key) FROM item_tags itg JOIN tags tg ON tg.id = itg.tag_id WHERE itg.item_id = i.id), '{}') AS tag_keys
      FROM items i
      JOIN sources s ON s.id = i.source_id
      WHERE ${whereClause}
      ORDER BY ${reported === "true" ? sql`i.reports_count DESC, ` : sql``} i.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
    db.execute(sql`
      SELECT count(*) AS total
      FROM items i
      WHERE ${whereClause}
    `),
  ]);

  const rows = rowsResult as unknown as {
    id: string;
    title: string;
    url: string;
    author: string | null;
    metrics: Record<string, number> | null;
    hidden: boolean;
    likes_count: number;
    dislikes_count: number;
    views_count: number;
    reports_count: number;
    published_at: string;
    created_at: string;
    source_name: string;
    topic_keys: string[];
    tag_keys: string[];
  }[];

  const total = Number((countResult as unknown as { total: string | number }[])[0]?.total ?? 0);

  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      author: r.author,
      metrics: r.metrics,
      hidden: r.hidden,
      likesCount: Number(r.likes_count ?? 0),
      dislikesCount: Number(r.dislikes_count ?? 0),
      viewsCount: Number(r.views_count ?? 0),
      reportsCount: Number(r.reports_count ?? 0),
      publishedAt: r.published_at,
      createdAt: r.created_at,
      sourceName: r.source_name,
      topics: r.topic_keys ?? [],
      tags: r.tag_keys ?? [],
    })),
    total,
  };
}

export async function setItemHidden(id: string, hidden: boolean) {
  const [updated] = await db
    .update(items)
    .set({ hidden })
    .where(eq(items.id, id))
    .returning({ id: items.id, hidden: items.hidden });
  return updated;
}

export async function dismissItemReports(id: string) {
  await db.delete(reports).where(eq(reports.itemId, id));
  const [updated] = await db
    .update(items)
    .set({ reportsCount: 0 })
    .where(eq(items.id, id))
    .returning({ id: items.id, reportsCount: items.reportsCount });
  return updated;
}
