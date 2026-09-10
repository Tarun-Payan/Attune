import Parser from "rss-parser";
import type { Connector, NormalizedItem, SourceConfig } from "./types";
import { stripHtml, truncate } from "../lib/normalize";
import { childLogger } from "../lib/logger";

const log = childLogger({ component: "connector", connector: "rss" });

type CustomFeedItem = Omit<Parser.Item, "creator"> & {
  mediaThumbnail?: { $: { url?: string } } | string;
  mediaContent?: { $: { url?: string } } | string;
  contentEncoded?: string;
  id?: string;
  author?: unknown;
  creator?: unknown;
};

const parser = new Parser<Record<string, unknown>, CustomFeedItem>({
  timeout: 15_000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 AttuneBot/0.2",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent"],
      ["content:encoded", "contentEncoded"],
      ["dc:creator", "creator"],
    ],
  },
});

export interface SubFeed {
  name?: string;
  url: string;
  topicHints?: string[];
}

function normalizeFeeds(config: SourceConfig): SubFeed[] {
  const list: SubFeed[] = [];
  const topHints = Array.isArray(config.topicHints) ? (config.topicHints as string[]) : [];

  if (Array.isArray(config.feeds)) {
    for (const item of config.feeds) {
      if (typeof item === "string" && item.trim()) {
        list.push({ url: item.trim(), topicHints: topHints });
      } else if (item && typeof item === "object") {
        const f = item as { name?: string; url?: string; topicHints?: string[]; topic?: string };
        const url = (f.url ?? "").trim();
        if (url) {
          const hints = Array.isArray(f.topicHints)
            ? f.topicHints
            : f.topic
              ? [f.topic]
              : topHints;
          list.push({
            name: typeof f.name === "string" ? f.name.trim() : undefined,
            url,
            topicHints: hints.length > 0 ? hints : topHints,
          });
        }
      }
    }
  } else if (typeof config.url === "string" && config.url.trim()) {
    list.push({
      name: typeof config.name === "string" ? config.name.trim() : undefined,
      url: config.url.trim(),
      topicHints: topHints,
    });
  }

  return list;
}

function extractImage(item: CustomFeedItem): string | undefined {
  if (item.enclosure?.url) {
    const type = item.enclosure.type ?? "";
    if (type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i.test(item.enclosure.url)) {
      return item.enclosure.url;
    }
  }
  if (item.mediaThumbnail) {
    if (typeof item.mediaThumbnail === "string") return item.mediaThumbnail;
    if (item.mediaThumbnail.$?.url) return item.mediaThumbnail.$.url;
  }
  if (item.mediaContent) {
    if (typeof item.mediaContent === "string") return item.mediaContent;
    if (item.mediaContent.$?.url) return item.mediaContent.$.url;
  }
  const html = item.contentEncoded ?? item.content ?? item.summary ?? "";
  const match = html.match(/<img[^>]+src=["'](https?:\/\/[^"'>]+)["']/i);
  if (match?.[1]) {
    return match[1];
  }
  return undefined;
}

function extractAuthor(item: CustomFeedItem, fallbackAuthor?: string): string | undefined {
  const raw = item.creator ?? item.author;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  if (Array.isArray(raw)) {
    const names = raw
      .map((r) => {
        if (typeof r === "string") return r.trim();
        if (r && typeof r === "object") {
          const name = Array.isArray(r.name) ? r.name[0] : r.name ?? r._;
          return typeof name === "string" ? name.trim() : "";
        }
        return "";
      })
      .filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const name = Array.isArray(r.name) ? r.name[0] : r.name ?? r._;
    if (typeof name === "string" && name.trim()) {
      return name.trim();
    }
  }
  return typeof fallbackAuthor === "string" && fallbackAuthor.trim() ? fallbackAuthor.trim() : undefined;
}

function extractTitle(item: CustomFeedItem): string {
  if (typeof item.title === "string" && item.title.trim()) return item.title.trim();
  if (item.title && typeof item.title === "object") {
    const t = item.title as Record<string, unknown>;
    const text = typeof t._ === "string" ? t._ : typeof t.name === "string" ? t.name : "";
    if (text.trim()) return text.trim();
  }
  return "Untitled";
}

function extractUrl(item: CustomFeedItem, fallbackUrl: string): string {
  if (typeof item.link === "string" && item.link.trim()) return item.link.trim();
  if (item.link && typeof item.link === "object") {
    const l = item.link as Record<string, unknown>;
    if (typeof l.$ === "object" && l.$ !== null && typeof (l.$ as any).href === "string") {
      return (l.$ as any).href.trim();
    }
    if (typeof l.href === "string") return l.href.trim();
  }
  if (typeof item.guid === "string" && item.guid.startsWith("http")) return item.guid.trim();
  if (typeof item.id === "string" && item.id.startsWith("http")) return item.id.trim();
  return fallbackUrl;
}

function extractExternalId(item: CustomFeedItem, fallbackId: string): string {
  if (typeof item.guid === "string" && item.guid.trim()) return item.guid.trim();
  if (typeof item.id === "string" && item.id.trim()) return item.id.trim();
  if (typeof item.link === "string" && item.link.trim()) return item.link.trim();
  return fallbackId;
}

export const rssConnector: Connector = {
  async fetch(config: SourceConfig): Promise<NormalizedItem[]> {
    const feeds = normalizeFeeds(config);
    if (feeds.length === 0) {
      throw new Error("RSS source config is missing 'url' or 'feeds'");
    }

    const results = await Promise.allSettled(
      feeds.map(async (feedConfig) => {
        const feed = await parser.parseURL(feedConfig.url);
        return { feedConfig, feed };
      }),
    );

    const out: NormalizedItem[] = [];
    let failed = 0;

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const feedConfig = feeds[i];

      if (res.status === "rejected") {
        failed += 1;
        log.warn(
          { url: feedConfig.url, name: feedConfig.name, reason: String(res.reason?.message ?? res.reason) },
          "RSS feed fetch failed",
        );
        continue;
      }

      const { feed } = res.value;
      const feedAuthor = feedConfig.name || (typeof feed.title === "string" ? feed.title.trim() : undefined);

      for (const item of (feed.items ?? []).slice(0, 30)) {
        const rawContent = item.contentEncoded ?? item.contentSnippet ?? item.content ?? item.summary ?? "";
        const cleanContent = stripHtml(rawContent);
        const published = item.isoDate
          ? new Date(item.isoDate)
          : item.pubDate
            ? new Date(item.pubDate)
            : new Date();

        const itemUrl = extractUrl(item, feedConfig.url);
        const externalId = extractExternalId(item, itemUrl);
        const title = extractTitle(item);
        const author = extractAuthor(item, feedAuthor);

        out.push({
          externalId: truncate(externalId, 300),
          url: truncate(itemUrl, 2000),
          title: truncate(title, 500),
          content: truncate(cleanContent || title || "No description", 4000),
          author: author ? truncate(author, 200) : undefined,
          imageUrl: extractImage(item),
          publishedAt: Number.isNaN(published.getTime()) ? new Date() : published,
          topicHints: feedConfig.topicHints && feedConfig.topicHints.length > 0 ? feedConfig.topicHints : undefined,
        });
      }
    }

    if (out.length === 0 && failed > 0) {
      throw new Error(`All ${failed} RSS feed(s) failed to fetch`);
    }

    return out;
  },
};
