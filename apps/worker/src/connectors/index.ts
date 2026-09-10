import type { Connector } from "./types";
import { rssConnector } from "./rss";
import { hackerNewsConnector } from "./hackernews";
import { githubTrendingConnector, githubReleasesConnector } from "./github";
import { redditConnector } from "./reddit";
import { youtubeConnector } from "./youtube";

/** Registry: source type (DB enum value) → connector implementation. */
export const connectors: Partial<Record<string, Connector>> = {
  RSS: rssConnector,
  HACKERNEWS: hackerNewsConnector,
  GITHUB_TRENDING: githubTrendingConnector,
  GITHUB_RELEASES: githubReleasesConnector,
  REDDIT: redditConnector,
  YOUTUBE: youtubeConnector,
};

export function hasConnector(type: string): boolean {
  return type in connectors;
}
