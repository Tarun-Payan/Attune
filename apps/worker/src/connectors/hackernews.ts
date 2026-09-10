import { fetchJson } from "../lib/http";
import { truncate } from "../lib/normalize";
import type { Connector, NormalizedItem } from "./types";

const BASE = "https://hacker-news.firebaseio.com/v0";

interface HNStory {
  id: number;
  title?: string;
  url?: string;
  by?: string;
  score?: number;
  descendants?: number;
  time?: number;
}

export const hackerNewsConnector: Connector = {
  async fetch(): Promise<NormalizedItem[]> {
    const ids = await fetchJson<number[]>(`${BASE}/topstories.json`);
    const stories = await Promise.all(
      ids.slice(0, 30).map((id) => fetchJson<HNStory | null>(`${BASE}/item/${id}.json`)),
    );
    return stories
      .filter((s): s is HNStory => Boolean(s && s.title))
      .map((s) => ({
        externalId: String(s.id),
        url: s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
        title: truncate(s.title!, 500),
        content: truncate(s.title!, 4000),
        author: s.by,
        metrics: { points: s.score ?? 0, comments: s.descendants ?? 0 },
        publishedAt: new Date((s.time ?? Math.floor(Date.now() / 1000)) * 1000),
      }));
  },
};
