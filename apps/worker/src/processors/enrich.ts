import { childLogger } from "../lib/logger";
import { clusterStories, generateSummaries } from "../services";

const log = childLogger({ component: "enrichProcessor" });

/**
 * AI summaries (blueprint §6): every 10 minutes, summarize the hottest
 * recent items that don't have one yet — hard-capped by a daily budget.
 */
export async function summarizeProcessor() {
  log.info("Starting AI summaries processor");
  const result = await generateSummaries();
  log.info(result, "AI summaries processor completed");
  return result;
}

/**
 * Story clustering (blueprint §6 step 2): group near-duplicate titles from
 * different sources into one cluster so the feed can say "reported by N".
 */
export async function clusterProcessor() {
  log.info("Starting story clustering processor");
  const result = await clusterStories();
  log.info(result, "Story clustering processor completed");
  return result;
}
