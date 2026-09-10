import { notify } from "@attune/notifications";
import { sendToUserDevices } from "../lib/push";
import {
  createNotificationLog,
  findItemsWithTopicsByIds,
  findSubscribersForTopics,
  getRecentSentTopicPushes,
  getUserById,
  getUserNotificationPrefs,
} from "../repository";

const USER_COOLDOWN_MS = 30 * 60_000; // min gap between pushes, per user

export interface NotifyResult {
  notified: number;
  throttled?: number;
  skipped?: number;
}

export async function processTopicMatches(itemIds: string[]): Promise<NotifyResult> {
  const rows = await findItemsWithTopicsByIds(itemIds);
  if (rows.length === 0) return { notified: 0 };

  const batchTopicKeys = [...new Set(rows.flatMap((r) => r.topicKeys))];
  const subRows = await findSubscribersForTopics(batchTopicKeys);

  const keysByUser = new Map<string, Set<string>>();
  for (const r of subRows) {
    let set = keysByUser.get(r.userId);
    if (!set) keysByUser.set(r.userId, (set = new Set()));
    set.add(r.topicKey);
  }

  let sent = 0;
  let throttled = 0;
  let skipped = 0;

  for (const [userId, myKeys] of keysByUser) {
    // Only stories whose topics intersect THIS user's subscribed topics
    const matched = rows.filter((r) => r.topicKeys.some((t) => myKeys.has(t)));
    if (matched.length === 0) continue;
    const top = matched.sort((a, b) => heat(b.metrics) - heat(a.metrics))[0];

    const user = await getUserById(userId);
    if (!user) continue;

    const prefs = await getUserNotificationPrefs(userId);

    // Defaults for users who never touched settings
    const pushEnabled = prefs?.pushEnabled ?? true;
    const maxPerHour = prefs?.maxPushPerHour ?? 3;

    if (!pushEnabled) {
      throttled += 1;
      await createNotificationLog({
        userId,
        itemId: null,
        channel: "push",
        kind: "topic_match",
        status: "throttled",
      });
      continue;
    }

    // Hourly cap + cooldown from the audit log
    const since = new Date(Date.now() - 3_600_000);
    const recent = await getRecentSentTopicPushes(userId, since);

    if (
      recent.length >= maxPerHour ||
      recent.some((r) => Date.now() - r.sentAt.getTime() < USER_COOLDOWN_MS)
    ) {
      throttled += 1;
      await createNotificationLog({
        userId,
        itemId: null,
        channel: "push",
        kind: "topic_match",
        status: "throttled",
      });
      continue;
    }

    // 1. Guaranteed in-app notification delivery to user's inbox
    await notify
      .techUpdate(userId, {
        title: top.title,
        itemId: top.itemId,
      })
      .catch(() => {});

    // 2. Best-effort external push notification
    const result = await sendToUserDevices(userId, {
      title: "New for you",
      body: top.title.slice(0, 120),
      data: { itemId: top.itemId },
    });

    if (result.delivered) {
      sent += 1;
      await createNotificationLog({
        userId,
        itemId: top.itemId,
        channel: "push",
        kind: "topic_match",
        status: "sent",
      });
    } else {
      skipped += 1;
      await createNotificationLog({
        userId,
        itemId: top.itemId,
        channel: "push",
        kind: "topic_match",
        status: "failed",
        error: result.error,
      });
    }
  }

  return { notified: sent, throttled, skipped };
}

function heat(metrics: Record<string, number> | null): number {
  if (!metrics) return 0;
  return Math.max(
    metrics.points ?? 0,
    metrics.score ?? 0,
    metrics.stars ?? 0,
    metrics.likes ?? 0,
    (metrics.views ?? 0) / 100,
    (metrics.comments ?? 0) / 10,
  );
}
