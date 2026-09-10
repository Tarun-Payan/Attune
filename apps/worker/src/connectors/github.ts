import { fetchJson } from "../lib/http";
import { truncate } from "../lib/normalize";
import type { Connector, NormalizedItem, SourceConfig } from "./types";

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

interface GHRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  created_at: string;
  topics?: string[];
}

// GitHub repo topics → our topic keys (hints only; the rule engine still runs)
const REPO_TOPIC_ALIASES: Record<string, string> = {
  "machine-learning": "ai", "artificial-intelligence": "ai", "deep-learning": "ai",
  llm: "ai", ai: "ai", llms: "ai",
  javascript: "webdev", typescript: "webdev", react: "webdev", nextjs: "webdev",
  nodejs: "webdev", node: "webdev", vue: "webdev", "react-native": "mobile",
  android: "mobile", kotlin: "mobile", swift: "mobile", ios: "mobile", flutter: "mobile",
  kubernetes: "devops", docker: "devops", terraform: "devops", aws: "devops",
  security: "cybersecurity", cybersecurity: "cybersecurity",
  blockchain: "crypto", cryptocurrency: "crypto", bitcoin: "crypto", ethereum: "crypto",
  game: "gaming", gamedev: "gaming", "game-development": "gaming",
  design: "design", figma: "design",
};

function repoTopicHints(topics: string[]): string[] {
  return [...new Set(topics.map((t) => REPO_TOPIC_ALIASES[t.toLowerCase()]).filter(Boolean))];
}

export const githubTrendingConnector: Connector = {
  // GitHub has no official "trending" API, so we approximate it with the Search API:
  // repos created in the last 7 days, ranked by stars ("new & notable").
  async fetch(config: SourceConfig): Promise<NormalizedItem[]> {
    const languages = Array.isArray(config.languages) ? (config.languages as string[]) : [];
    if (languages.length === 0) throw new Error("config.languages is missing");
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const results = await Promise.all(
      languages.map(async (lang) => {
        const q = encodeURIComponent(`stars:>40 created:>${since} language:${lang}`);
        const data = await fetchJson<{ items: GHRepo[] }>(
          `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=10`,
          { headers: ghHeaders() },
        );
        return data.items ?? [];
      }),
    );
    return results.flat().map((r) => ({
      externalId: r.full_name,
      url: r.html_url,
      title: truncate(`${r.full_name}${r.description ? ` — ${r.description}` : ""}`, 500),
      content:
        truncate(
          [r.description ?? "", r.topics?.length ? `Topics: ${r.topics.join(", ")}` : ""]
            .filter(Boolean)
            .join(" · "),
          4000,
        ) || r.full_name,
      metrics: { stars: r.stargazers_count, forks: r.forks_count },
      publishedAt: new Date(r.created_at),
      topicHints: repoTopicHints(r.topics ?? []),
    }));
  },
};

interface GHRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  author?: { login: string } | null;
}

export const githubReleasesConnector: Connector = {
  async fetch(config: SourceConfig): Promise<NormalizedItem[]> {
    const repos = Array.isArray(config.repos) ? (config.repos as string[]) : [];
    if (repos.length === 0) throw new Error("config.repos is missing");
    const results = await Promise.all(
      repos.map((repo) =>
        fetchJson<GHRelease[]>(`https://api.github.com/repos/${repo}/releases?per_page=5`, {
          headers: ghHeaders(),
        }),
      ),
    );
    const out: NormalizedItem[] = [];
    results.forEach((releases, i) => {
      const repo = repos[i];
      for (const rel of releases) {
        out.push({
          externalId: String(rel.id),
          url: rel.html_url,
          title: truncate(`${repo} released ${rel.name ?? rel.tag_name}`, 500),
          content: truncate(rel.body ?? "", 4000) || `New release ${rel.tag_name} of ${repo}.`,
          author: rel.author?.login,
          publishedAt: new Date(rel.published_at ?? Date.now()),
        });
      }
    });
    return out;
  },
};
