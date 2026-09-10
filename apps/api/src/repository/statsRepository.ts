import { sql } from "drizzle-orm";
import { db } from "@attune/db/client";
import type { AdminDashboardStats } from "@attune/types";

export async function getDashboardMetrics(): Promise<AdminDashboardStats> {
  const scalar = async (q: ReturnType<typeof sql>) => {
    const rows = (await db.execute(q)) as unknown as { n: string | number }[];
    return Number(rows[0]?.n ?? 0);
  };

  const list = async <T>(q: ReturnType<typeof sql>) =>
    (await db.execute(q)) as unknown as T[];

  const [usersTotal, usersNewToday, itemsTotal, itemsToday, interactionsToday, notifSentToday] =
    await Promise.all([
      scalar(sql`SELECT count(*) AS n FROM users`),
      scalar(sql`SELECT count(*) AS n FROM users WHERE created_at > now() - interval '24 hours'`),
      scalar(sql`SELECT count(*) AS n FROM items`),
      scalar(sql`SELECT count(*) AS n FROM items WHERE created_at > now() - interval '24 hours'`),
      scalar(sql`SELECT count(*) AS n FROM interactions WHERE created_at > now() - interval '24 hours'`),
      scalar(sql`SELECT count(*) AS n FROM notification_logs WHERE status = 'sent' AND sent_at > now() - interval '24 hours'`),
    ]);

  const [
    usersTrend,
    itemsTrend,
    interactionsTrend,
    notifTrend,
    interactionsByType,
    itemsBySourceType,
    failingSources,
    topTopics,
  ] = await Promise.all([
    list<{ date: string; count: number }>(sql`
      SELECT to_char(d::date, 'MM-DD') AS date, count(u.id)::int AS count
      FROM generate_series((now() - interval '6 days')::date, now()::date, '1 day'::interval) d
      LEFT JOIN users u ON date_trunc('day', u.created_at) = d
      GROUP BY d ORDER BY d ASC
    `),
    list<{ date: string; count: number }>(sql`
      SELECT to_char(d::date, 'MM-DD') AS date, count(i.id)::int AS count
      FROM generate_series((now() - interval '6 days')::date, now()::date, '1 day'::interval) d
      LEFT JOIN items i ON date_trunc('day', i.created_at) = d
      GROUP BY d ORDER BY d ASC
    `),
    list<{ date: string; count: number }>(sql`
      SELECT to_char(d::date, 'MM-DD') AS date, count(ix.id)::int AS count
      FROM generate_series((now() - interval '6 days')::date, now()::date, '1 day'::interval) d
      LEFT JOIN interactions ix ON date_trunc('day', ix.created_at) = d
      GROUP BY d ORDER BY d ASC
    `),
    list<{ date: string; count: number }>(sql`
      SELECT to_char(d::date, 'MM-DD') AS date, count(nl.id)::int AS count
      FROM generate_series((now() - interval '6 days')::date, now()::date, '1 day'::interval) d
      LEFT JOIN notification_logs nl ON date_trunc('day', nl.sent_at) = d AND nl.status = 'sent'
      GROUP BY d ORDER BY d ASC
    `),
    list<{ type: string; count: number }>(sql`
      SELECT type, count(*)::int AS count
      FROM interactions
      WHERE created_at > now() - interval '7 days'
      GROUP BY type ORDER BY count DESC
    `),
    list<{ type: string; count: number }>(sql`
      SELECT s.type, count(i.id)::int AS count
      FROM items i
      JOIN sources s ON s.id = i.source_id
      WHERE i.created_at > now() - interval '7 days'
      GROUP BY s.type ORDER BY count DESC
    `),
    list<{ id: string; name: string; error: string | null; started_at: string }>(sql`
      SELECT DISTINCT ON (s.id) s.id, s.name, r.error, r.started_at
      FROM sources s
      JOIN sync_runs r ON r.source_id = s.id
      WHERE s.enabled = true
      ORDER BY s.id, r.started_at DESC
    `).then((rows) =>
      rows.filter((r) => r.error !== null).map((r) => ({
        id: r.id,
        name: r.name,
        error: (r.error ?? "").slice(0, 90),
        at: r.started_at,
      })),
    ),
    list<{ key: string; name: string; icon: string | null; n: string }>(sql`
      SELECT t.key, t.name, t.icon, count(it.item_id) AS n
      FROM topics t
      JOIN item_topics it ON it.topic_id = t.id
      JOIN items i ON i.id = it.item_id AND i.published_at > now() - interval '7 days'
      GROUP BY t.id ORDER BY n DESC LIMIT 8
    `).then((rows) => rows.map((r) => ({ ...r, n: Number(r.n) }))),
  ]);

  return {
    usersTotal,
    usersNewToday,
    itemsTotal,
    itemsToday,
    interactionsToday,
    notifSentToday,
    usersTrend,
    itemsTrend,
    interactionsTrend,
    notifTrend,
    interactionsByType,
    itemsBySourceType,
    failingSources,
    topTopics,
  };
}
