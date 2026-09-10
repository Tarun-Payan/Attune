import { fetchJson } from "../lib/http";
import { truncate } from "../lib/normalize";
import { childLogger } from "../lib/logger";
import type { Connector, NormalizedItem, SourceConfig } from "./types";

const log = childLogger({ component: "connector", connector: "reddit" });

interface RedditListing {
  data: { children: { data: RedditPost }[] };
}
interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  author: string;
  stickied: boolean;
  over_18: boolean;
  url_overridden_by_dest?: string;
}

// Subreddit → topic key (conservative; everything else goes through keyword rules)
const SUBREDDIT_HINTS: Record<string, string> = {
  artificial: "ai", machinelearning: "ai", localai: "ai", llm: "ai",
  webdev: "webdev", frontend: "webdev", javascript: "webdev", typescript: "webdev", node: "webdev",
  androiddev: "mobile", iosprogramming: "mobile", flutterdev: "mobile",
  devops: "devops", kubernetes: "devops",
  netsec: "cybersecurity", cybersecurity: "cybersecurity",
  startups: "startups", indianstartups: "startups",
  gaming: "gaming", pcgaming: "gaming",
  cryptocurrency: "crypto", bitcoin: "crypto",
};

export const redditConnector: Connector = {
  async fetch(config: SourceConfig): Promise<NormalizedItem[]> {
    const subs = Array.isArray(config.subreddits) ? (config.subreddits as string[]) : [];
    if (subs.length === 0) throw new Error("config.subreddits is missing");
    // One blocked subreddit must not kill the whole sync — settle individually
    const results = await Promise.allSettled(
      subs.map((sub) =>
        fetchJson<RedditListing>(
          `https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json?limit=25&raw_json=1`,
        ),
      ),
    );
    const out: NormalizedItem[] = [];
    let failed = 0;
    results.forEach((result, i) => {
      const sub = subs[i].toLowerCase();
      const hint = SUBREDDIT_HINTS[sub];
      if (result.status === "rejected") {
        failed += 1;
        log.warn({ sub, reason: String(result.reason?.message ?? result.reason) }, "subreddit fetch failed");
        return;
      }
      for (const p of result.value.data.children.map((c) => c.data)) {
        if (p.stickied || p.over_18) continue;
        out.push({
          externalId: p.id,
          url: `https://www.reddit.com${p.permalink}`,
          title: truncate(p.title, 500),
          content: truncate(p.selftext || p.title, 4000),
          author: p.author,
          imageUrl:
            p.url_overridden_by_dest && /\.(jpe?g|png|webp)$/i.test(p.url_overridden_by_dest)
              ? p.url_overridden_by_dest
              : undefined,
          metrics: { score: p.score, comments: p.num_comments },
          publishedAt: new Date(p.created_utc * 1000),
          topicHints: hint ? [hint] : [],
        });
      }
    });
    if (out.length === 0 && failed > 0) {
      throw new Error(`all ${failed} subreddits failed (Reddit may be blocking this client — needs OAuth app)`);
    }
    return out;
  },
};
