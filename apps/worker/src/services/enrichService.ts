import { AI_MAX_RPD, aiConfigured, summarizeStory } from "../lib/ai";
import { childLogger } from "../lib/logger";
import {
  attachItemsToClusters,
  countRecentAiSummaries,
  createCluster,
  findClusterStateForPair,
  findUnclusteredPairs,
  findUnsummarizedHottestItems,
  updateItemCluster,
  updateItemSummary,
} from "../repository";

const log = childLogger({ component: "enrichService" });

const BATCH = 10;
const SIMILARITY_THRESHOLD = 0.55;

export interface SummarizeResult {
  skipped?: string;
  summarized?: number;
  candidates?: number;
  used?: number;
}

export interface ClusterResult {
  attached: number;
  clustersCreated: number;
}

export async function generateSummaries(): Promise<SummarizeResult> {
  if (!aiConfigured()) {
    return { skipped: "ai not configured" };
  }

  // Budget: rough count of AI work in the last 24h (summaries + brief)
  const used = await countRecentAiSummaries();
  if (used >= AI_MAX_RPD) {
    return { skipped: "daily AI cap reached", used };
  }
  const allowed = Math.min(BATCH, AI_MAX_RPD - used);

  // Hottest un-summarized recent items first (points/score/stars)
  const rows = await findUnsummarizedHottestItems(allowed);

  let summarized = 0;
  for (const row of rows) {
    const summary = await summarizeStory(row.title, row.content);
    if (summary) {
      await updateItemSummary(row.id, summary);
      summarized += 1;
    }
  }
  if (summarized > 0) log.info({ summarized, used }, "AI summaries written");
  return { summarized, candidates: rows.length, used };
}

export async function clusterStories(): Promise<ClusterResult> {
  // 1) Attach unclustered items to existing clusters via title similarity
  const attached = await attachItemsToClusters(SIMILARITY_THRESHOLD);

  // 2) Pair still-unclustered near-duplicates → create new clusters
  const pairs = await findUnclusteredPairs(SIMILARITY_THRESHOLD, 100);

  let created = 0;
  for (const pair of pairs) {
    // Re-check: earlier pairs in this loop may have clustered them already
    const state = await findClusterStateForPair(pair.aid, pair.bid);
    if (!state) continue;
    if (state.aCluster && state.bCluster) continue;

    if (state.aCluster || state.bCluster) {
      // One got clustered meanwhile → attach the other
      const clusterId = state.aCluster ?? state.bCluster;
      const orphan = state.aCluster ? pair.bid : pair.aid;
      if (clusterId) {
        await updateItemCluster([orphan], clusterId);
      }
      continue;
    }

    // Fresh cluster: canonical title = the longer of the two
    const canonicalTitle = pair.atitle.length >= pair.btitle.length ? pair.atitle : pair.btitle;
    const newClusterId = await createCluster(canonicalTitle);
    await updateItemCluster([pair.aid, pair.bid], newClusterId);
    created += 1;
  }

  if (attached > 0 || created > 0) {
    log.info({ attached, clustersCreated: created }, "clustering pass done");
  }
  return { attached, clustersCreated: created };
}
