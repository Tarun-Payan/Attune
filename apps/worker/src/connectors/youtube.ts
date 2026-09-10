import Parser from "rss-parser";
import type { Connector, NormalizedItem, SourceConfig } from "./types";
import { stripHtml, truncate } from "../lib/normalize";
import { childLogger } from "../lib/logger";

const log = childLogger({ component: "connector", connector: "youtube" });

interface YouTubeChannelConfig {
  id?: string;
  channelId?: string;
  name?: string;
  topicHints?: string[];
  topic?: string;
}

interface MediaGroup {
  "media:title"?: string[];
  "media:description"?: string[];
  "media:thumbnail"?: { $: { url: string; width?: string; height?: string } }[];
  "media:community"?: {
    "media:statistics"?: { $: { views?: string } }[];
    "media:starRating"?: { $: { count?: string; average?: string } }[];
  }[];
}

interface YouTubeFeedItem extends Parser.Item {
  id?: string;
  guid?: string;
  videoId?: string;
  channelId?: string;
  mediaGroup?: MediaGroup;
}

const parser = new Parser<Record<string, unknown>, YouTubeFeedItem>({
  timeout: 15_000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; AttuneBot/0.1)" },
  customFields: {
    item: [
      ["media:group", "mediaGroup"],
      ["yt:videoId", "videoId"],
      ["yt:channelId", "channelId"],
    ],
  },
});

function normalizeChannels(config: SourceConfig): { id: string; name?: string; topicHints?: string[] }[] {
  const list: { id: string; name?: string; topicHints?: string[] }[] = [];

  if (Array.isArray(config.channels)) {
    for (const item of config.channels) {
      if (typeof item === "string" && item.trim()) {
        list.push({ id: item.trim() });
      } else if (item && typeof item === "object") {
        const c = item as YouTubeChannelConfig;
        const id = (c.id || c.channelId || "").trim();
        if (id) {
          const hints = Array.isArray(c.topicHints) ? c.topicHints : c.topic ? [c.topic] : undefined;
          list.push({ id, name: c.name?.trim(), topicHints: hints });
        }
      }
    }
  } else if (typeof config.channelId === "string" && config.channelId.trim()) {
    list.push({ id: config.channelId.trim(), name: typeof config.name === "string" ? config.name : undefined });
  } else if (typeof config.id === "string" && config.id.trim()) {
    list.push({ id: config.id.trim(), name: typeof config.name === "string" ? config.name : undefined });
  } else if (typeof config.url === "string" && config.url.trim()) {
    // If a direct URL or feed URL was provided
    const match = config.url.match(/channel_id=([a-zA-Z0-9_-]+)/) || config.url.match(/\/channel\/([a-zA-Z0-9_-]+)/);
    if (match?.[1]) {
      list.push({ id: match[1], name: typeof config.name === "string" ? config.name : undefined });
    }
  }

  return list;
}

export const youtubeConnector: Connector = {
  async fetch(config: SourceConfig): Promise<NormalizedItem[]> {
    const channels = normalizeChannels(config);
    if (channels.length === 0) {
      throw new Error("YouTube source config is missing 'channels' with valid channel IDs");
    }

    const results = await Promise.allSettled(
      channels.map(async (ch) => {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(ch.id)}`;
        const feed = await parser.parseURL(feedUrl);
        return { channel: ch, feed };
      }),
    );

    const out: NormalizedItem[] = [];
    let failed = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const ch = channels[i];

      if (result.status === "rejected") {
        failed += 1;
        log.warn(
          { channelId: ch.id, channelName: ch.name, reason: String(result.reason?.message ?? result.reason) },
          "YouTube channel feed fetch failed",
        );
        continue;
      }

      const { feed } = result.value;
      const channelAuthor = ch.name || feed.title || undefined;

      for (const item of (feed.items ?? []).slice(0, 30)) {
        const mg = item.mediaGroup;
        const description = mg?.["media:description"]?.[0] ?? item.contentSnippet ?? item.content ?? "";
        const cleanContent = stripHtml(description);
        const videoId = item.videoId || (item.link ? item.link.match(/v=([a-zA-Z0-9_-]+)/)?.[1] : undefined);
        const url = item.link || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : `https://www.youtube.com/channel/${ch.id}`);
        const externalId = item.id || (videoId ? `yt:video:${videoId}` : url);

        const thumbnail =
          mg?.["media:thumbnail"]?.[0]?.["$"]?.url ||
          (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined);

        const views = Number(mg?.["media:community"]?.[0]?.["media:statistics"]?.[0]?.["$"]?.views);
        const ratingCount = Number(mg?.["media:community"]?.[0]?.["media:starRating"]?.[0]?.["$"]?.count);

        const metrics: Record<string, number> = {};
        if (!Number.isNaN(views) && views > 0) metrics.views = views;
        if (!Number.isNaN(ratingCount) && ratingCount > 0) {
          metrics.likes = ratingCount;
          metrics.ratingCount = ratingCount;
        }

        const published = item.isoDate
          ? new Date(item.isoDate)
          : item.pubDate
            ? new Date(item.pubDate)
            : new Date();

        out.push({
          externalId: truncate(externalId, 300),
          url: truncate(url, 2000),
          title: truncate(item.title?.trim() || "Untitled Video", 500),
          content: truncate(cleanContent || item.title || "YouTube Video", 4000),
          author: channelAuthor ? truncate(channelAuthor, 200) : undefined,
          imageUrl: thumbnail,
          metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
          publishedAt: Number.isNaN(published.getTime()) ? new Date() : published,
          topicHints: ch.topicHints,
        });
      }
    }

    if (out.length === 0 && failed > 0) {
      throw new Error(`All ${failed} YouTube channels failed to fetch`);
    }

    return out;
  },
};
