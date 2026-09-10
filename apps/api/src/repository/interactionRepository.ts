import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@attune/db/client";
import {
  interactions,
  items,
  itemTags,
  itemTopics,
  reports,
  userTags,
  userTopics,
  users,
} from "@attune/db/schema";
import type { InteractionType, ReportReason } from "@attune/types";
import { getSystemSettings } from "./settingsRepository";

export interface RecordInteractionData {
  userId: string;
  itemId: string;
  type: InteractionType;
  dwellMs?: number | null;
  reason?: ReportReason;
  details?: string;
}

interface RawStatsRow {
  days: string[];
  minutes_week: string;
  views_week: string;
  saves_total: string;
  total_platform_minutes: string;
  top_topics: { key: string; n: string }[] | null;
}

export async function checkItemExists(itemId: string) {
  const [item] = await db
    .select({ id: items.id, hidden: items.hidden })
    .from(items)
    .where(eq(items.id, itemId));
  return item;
}

export async function getUserItemState(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return new Map<string, { liked: boolean; disliked: boolean; saved: boolean }>();

  const rows = await db
    .select({
      itemId: interactions.itemId,
      type: interactions.type,
    })
    .from(interactions)
    .where(
      and(
        eq(interactions.userId, userId),
        inArray(interactions.itemId, itemIds),
        inArray(interactions.type, ["LIKE", "DISLIKE", "SAVE"]),
      ),
    );

  const stateMap = new Map<string, { liked: boolean; disliked: boolean; saved: boolean }>();
  for (const id of itemIds) {
    stateMap.set(id, { liked: false, disliked: false, saved: false });
  }

  for (const r of rows) {
    const s = stateMap.get(r.itemId) ?? { liked: false, disliked: false, saved: false };
    if (r.type === "LIKE") s.liked = true;
    if (r.type === "DISLIKE") s.disliked = true;
    if (r.type === "SAVE") s.saved = true;
    stateMap.set(r.itemId, s);
  }

  return stateMap;
}

export async function handleLikeInteraction(userId: string, itemId: string) {
  // Check existing state
  const [existingLike] = await db
    .select({ id: interactions.id })
    .from(interactions)
    .where(and(eq(interactions.userId, userId), eq(interactions.itemId, itemId), eq(interactions.type, "LIKE")));

  if (existingLike) {
    // Toggle off LIKE
    await db.delete(interactions).where(eq(interactions.id, existingLike.id));
    await db.execute(sql`UPDATE items SET likes_count = greatest(0, likes_count - 1) WHERE id = ${itemId}`);
    await nudgeTopicAndTagWeights(userId, itemId, -0.25, -0.35);
    return { recorded: true, toggledOff: true };
  }

  // If had DISLIKE, remove it
  const [existingDislike] = await db
    .select({ id: interactions.id })
    .from(interactions)
    .where(and(eq(interactions.userId, userId), eq(interactions.itemId, itemId), eq(interactions.type, "DISLIKE")));

  if (existingDislike) {
    await db.delete(interactions).where(eq(interactions.id, existingDislike.id));
    await db.execute(sql`UPDATE items SET dislikes_count = greatest(0, dislikes_count - 1) WHERE id = ${itemId}`);
  }

  // Add LIKE
  await db.insert(interactions).values({
    userId,
    itemId,
    type: "LIKE",
  });
  await db.execute(sql`UPDATE items SET likes_count = likes_count + 1 WHERE id = ${itemId}`);
  await nudgeTopicAndTagWeights(userId, itemId, 0.25, 0.35);

  return { recorded: true, toggledOff: false };
}

export async function handleDislikeInteraction(userId: string, itemId: string) {
  const [existingDislike] = await db
    .select({ id: interactions.id })
    .from(interactions)
    .where(and(eq(interactions.userId, userId), eq(interactions.itemId, itemId), eq(interactions.type, "DISLIKE")));

  if (existingDislike) {
    // Toggle off DISLIKE
    await db.delete(interactions).where(eq(interactions.id, existingDislike.id));
    await db.execute(sql`UPDATE items SET dislikes_count = greatest(0, dislikes_count - 1) WHERE id = ${itemId}`);
    await nudgeTopicAndTagWeights(userId, itemId, 0.30, 0.40);
    return { recorded: true, toggledOff: true };
  }

  // If had LIKE, remove it
  const [existingLike] = await db
    .select({ id: interactions.id })
    .from(interactions)
    .where(and(eq(interactions.userId, userId), eq(interactions.itemId, itemId), eq(interactions.type, "LIKE")));

  if (existingLike) {
    await db.delete(interactions).where(eq(interactions.id, existingLike.id));
    await db.execute(sql`UPDATE items SET likes_count = greatest(0, likes_count - 1) WHERE id = ${itemId}`);
  }

  // Add DISLIKE
  await db.insert(interactions).values({
    userId,
    itemId,
    type: "DISLIKE",
  });
  await db.execute(sql`UPDATE items SET dislikes_count = dislikes_count + 1 WHERE id = ${itemId}`);
  // Personal penalty only
  await nudgeTopicAndTagWeights(userId, itemId, -0.30, -0.40);

  return { recorded: true, toggledOff: false };
}

export async function handleReportInteraction(userId: string, itemId: string, reason: ReportReason = "OTHER", details?: string) {
  // Record report row
  await db
    .insert(reports)
    .values({
      userId,
      itemId,
      reason,
      details: details ?? null,
    })
    .onConflictDoNothing();

  // Record interaction
  await db.insert(interactions).values({
    userId,
    itemId,
    type: "REPORT",
  });

  // Increment reports_count
  await db.execute(sql`UPDATE items SET reports_count = reports_count + 1 WHERE id = ${itemId}`);

  // Auto-hide check
  const settings = await getSystemSettings();
  const [reportCountRow] = await db
    .select({ count: sql<number>`count(DISTINCT user_id)` })
    .from(reports)
    .where(eq(reports.itemId, itemId));

  const distinctReports = Number(reportCountRow?.count ?? 0);
  if (distinctReports >= settings.reportAutoHideThreshold) {
    await db.execute(sql`UPDATE items SET hidden = true WHERE id = ${itemId}`);
  }

  // Personal penalty for user
  await nudgeTopicAndTagWeights(userId, itemId, -0.50, -0.50);

  return { recorded: true };
}

export async function handleViewInteraction(userId: string, itemId: string, dwellMs?: number | null) {
  await db.insert(interactions).values({
    userId,
    itemId,
    type: "VIEW",
    dwellMs: dwellMs ?? null,
  });

  await db.execute(sql`UPDATE items SET views_count = views_count + 1 WHERE id = ${itemId}`);

  if (dwellMs && dwellMs > 0) {
    // Increment total user platform dwell time
    await db.execute(sql`UPDATE users SET total_dwell_ms = total_dwell_ms + ${dwellMs} WHERE id = ${userId}`);

    // Increment dwell time and views on user_topics and user_tags
    await db.execute(sql`
      UPDATE user_topics ut
      SET total_dwell_ms = ut.total_dwell_ms + ${dwellMs},
          views_count = ut.views_count + 1
      FROM item_topics it
      WHERE it.item_id = ${itemId} AND it.topic_id = ut.topic_id AND ut.user_id = ${userId}
    `);

    await db.execute(sql`
      UPDATE user_tags ut
      SET total_dwell_ms = ut.total_dwell_ms + ${dwellMs},
          views_count = ut.views_count + 1
      FROM item_tags it
      WHERE it.item_id = ${itemId} AND it.tag_id = ut.tag_id AND ut.user_id = ${userId}
    `);

    // Dwell tier delta
    let delta = 0.03;
    if (dwellMs < 4_000) delta = -0.02;
    else if (dwellMs >= 120_000) delta = 0.25;
    else if (dwellMs >= 60_000) delta = 0.15;
    else if (dwellMs >= 20_000) delta = 0.08;

    await nudgeTopicAndTagWeights(userId, itemId, delta, delta * 1.2);
  }

  return { recorded: true };
}

export async function nudgeTopicAndTagWeights(userId: string, itemId: string, topicDelta: number, tagDelta: number) {
  if (topicDelta !== 0) {
    // UPSERT topic weights
    await db.execute(sql`
      INSERT INTO user_topics (user_id, topic_id, weight, notify, total_dwell_ms, views_count)
      SELECT ${userId}, itt.topic_id, least(3.0, greatest(0.1, 1.0 + ${topicDelta})), false, 0, 1
      FROM item_topics itt
      WHERE itt.item_id = ${itemId}
      ON CONFLICT (user_id, topic_id)
      DO UPDATE SET weight = least(3.0, greatest(0.1, user_topics.weight + ${topicDelta}))
    `);
  }

  if (tagDelta !== 0) {
    // UPSERT tag weights
    await db.execute(sql`
      INSERT INTO user_tags (user_id, tag_id, weight, total_dwell_ms, views_count)
      SELECT ${userId}, itg.tag_id, least(3.0, greatest(0.1, 1.0 + ${tagDelta})), 0, 1
      FROM item_tags itg
      WHERE itg.item_id = ${itemId}
      ON CONFLICT (user_id, tag_id)
      DO UPDATE SET weight = least(3.0, greatest(0.1, user_tags.weight + ${tagDelta}))
    `);
  }
}

export async function recordInteraction(data: RecordInteractionData) {
  if (data.type === "LIKE") {
    return handleLikeInteraction(data.userId, data.itemId);
  }
  if (data.type === "DISLIKE") {
    return handleDislikeInteraction(data.userId, data.itemId);
  }
  if (data.type === "REPORT") {
    return handleReportInteraction(data.userId, data.itemId, data.reason, data.details);
  }
  if (data.type === "VIEW") {
    return handleViewInteraction(data.userId, data.itemId, data.dwellMs);
  }

  // SAVE, HIDE, OPEN_LINK, SHARE
  const [created] = await db
    .insert(interactions)
    .values({
      userId: data.userId,
      itemId: data.itemId,
      type: data.type,
      dwellMs: data.dwellMs ?? null,
    })
    .returning();

  let topicDelta = 0;
  let tagDelta = 0;
  if (data.type === "SAVE") {
    topicDelta = 0.20;
    tagDelta = 0.25;
  } else if (data.type === "SHARE") {
    topicDelta = 0.15;
    tagDelta = 0.20;
  } else if (data.type === "OPEN_LINK") {
    topicDelta = 0.05;
    tagDelta = 0.08;
  } else if (data.type === "HIDE") {
    topicDelta = -0.20;
    tagDelta = -0.25;
  }

  if (topicDelta !== 0) {
    await nudgeTopicAndTagWeights(data.userId, data.itemId, topicDelta, tagDelta);
  }

  return created;
}

export async function getReadingStatsData(userId: string) {
  const rows = (await db.execute(sql`
    SELECT
      (SELECT array_agg(d ORDER BY d DESC) FROM (
         SELECT DISTINCT (it.created_at AT TIME ZONE coalesce(u.timezone, 'UTC'))::date::text AS d
         FROM interactions it
         JOIN users u ON u.id = it.user_id
         WHERE it.user_id = ${userId}
           AND it.created_at > now() - interval '60 days'
      ) days) AS days,
      (SELECT round(coalesce(sum(dwell_ms), 0)::numeric / 60000.0) FROM interactions
        WHERE user_id = ${userId} AND type = 'VIEW' AND created_at > now() - interval '7 days') AS minutes_week,
      (SELECT count(*) FROM interactions
        WHERE user_id = ${userId} AND type = 'VIEW' AND created_at > now() - interval '7 days') AS views_week,
      (SELECT count(*) FROM interactions
        WHERE user_id = ${userId} AND type = 'SAVE') AS saves_total,
      (SELECT round(coalesce(u.total_dwell_ms, 0)::numeric / 60000.0) FROM users u WHERE u.id = ${userId}) AS total_platform_minutes,
      (SELECT json_agg(x) FROM (
         SELECT t.key, count(*) AS n
         FROM interactions it
         JOIN item_topics itt ON itt.item_id = it.item_id
         JOIN topics t ON t.id = itt.topic_id
         WHERE it.user_id = ${userId} AND it.created_at > now() - interval '7 days'
         GROUP BY t.key ORDER BY n DESC LIMIT 3
      ) x) AS top_topics
  `)) as unknown as RawStatsRow[];

  const r = rows[0];
  const rawDays: unknown = r?.days;
  const dayList: string[] = Array.isArray(rawDays)
    ? rawDays.map((d) => {
        if (d instanceof Date) return d.toISOString().slice(0, 10);
        const s = String(d);
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const parsed = new Date(s);
        return isNaN(parsed.getTime()) ? s : parsed.toISOString().slice(0, 10);
      })
    : typeof rawDays === "string"
      ? rawDays.replace(/^\{|\}$/g, "").split(",").filter(Boolean).map((s) => s.slice(0, 10))
      : [];

  return {
    dayList,
    minutesWeek: Number(r?.minutes_week ?? 0),
    viewsWeek: Number(r?.views_week ?? 0),
    savesTotal: Number(r?.saves_total ?? 0),
    totalPlatformMinutes: Number(r?.total_platform_minutes ?? 0),
    topTopics: Array.isArray(r?.top_topics)
      ? r.top_topics.map((t) => ({ key: t.key, interactions: Number(t.n) }))
      : [],
  };
}
