import { childLogger } from "../lib/logger";
import { sweepCategorization } from "../services";

const log = childLogger({ component: "categorizeProcessor" });

/**
 * Processor for periodic categorization sweeps.
 * Examines newly ingested orphan items and assigns topics/tags via rule matching or AI.
 */
export async function categorizeSweepProcessor() {
  log.info("Starting scheduled categorization sweep");
  const result = await sweepCategorization();
  log.info(result, "Categorization sweep finished");
  return result;
}
