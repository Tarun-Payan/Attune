import { aiConfigured, categorizeStory } from "../lib/ai";
import { categorize, extractTags } from "../lib/categorize";
import { childLogger } from "../lib/logger";
import {
  batchLinkItemTags,
  batchLinkItemTopics,
  findUntaggedOrphanItems,
  getTagIdByKeyMap,
  getTopicIdByKeyMap,
  type UntaggedItem,
} from "../repository";

const log = childLogger({ component: "pipelineService" });

export interface SweepResult {
  scanned?: number;
  tagged: number;
  aiTagged?: number;
}

export async function sweepCategorization(): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - 24 * 3_600_000); // 24 hours ago
  const orphans = await findUntaggedOrphanItems(cutoff, 200);

  if (orphans.length === 0) return { tagged: 0 };

  const topicIdByKey = await getTopicIdByKeyMap();
  const tagIdByKey = await getTagIdByKeyMap();
  const links: { itemId: string; topicId: string; confidence: number; method: string }[] = [];
  const tagLinks: { itemId: string; tagId: string }[] = [];
  const stillUntagged: UntaggedItem[] = [];

  // Pass 1: keyword rules (free)
  for (const o of orphans) {
    const text = `${o.title} ${o.content}`;
    const matches = categorize(text);
    if (matches.length > 0) {
      for (const m of matches) {
        const topicId = topicIdByKey.get(m.topicKey);
        if (topicId) links.push({ itemId: o.id, topicId, confidence: m.confidence, method: "rule" });
      }
    } else {
      stillUntagged.push(o);
    }

    const tags = extractTags(text);
    for (const tagKey of tags) {
      const tagId = tagIdByKey.get(tagKey);
      if (tagId) tagLinks.push({ itemId: o.id, tagId });
    }
  }

  // Pass 2: AI fallback for the rest (needs GEMINI_API_KEY)
  let aiTagged = 0;
  if (aiConfigured() && stillUntagged.length > 0) {
    const keys = [...topicIdByKey.keys()];
    for (const o of stillUntagged.slice(0, 10)) {
      const matches = await categorizeStory(o.title, o.content, keys);
      if (matches && matches.length > 0) {
        for (const m of matches) {
          const topicId = topicIdByKey.get(m.key);
          if (topicId) {
            links.push({ itemId: o.id, topicId, confidence: m.confidence, method: "ai" });
            aiTagged += 1;
          }
        }
      }
    }
    if (aiTagged > 0) log.info({ aiTagged }, "AI categorized previously untagged items");
  }

  if (links.length > 0) {
    await batchLinkItemTopics(links);
  }
  if (tagLinks.length > 0) {
    await batchLinkItemTags(tagLinks);
  }

  return { scanned: orphans.length, tagged: links.length, aiTagged };
}
