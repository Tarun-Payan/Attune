import { describe, expect, it } from "vitest";
import { rssConnector } from "./rss";

describe("rssConnector", () => {
  it("throws when config has no url or feeds", async () => {
    await expect(rssConnector.fetch({})).rejects.toThrow("RSS source config is missing 'url' or 'feeds'");
  });

  it("handles feeds array with invalid feed URLs by throwing descriptive error when all fail", async () => {
    await expect(
      rssConnector.fetch({
        feeds: [
          { name: "Nonexistent Feed 1", url: "http://127.0.0.1:59999/feed1.xml", topicHints: ["ai"] },
          { name: "Nonexistent Feed 2", url: "http://127.0.0.1:59999/feed2.xml", topicHints: ["webdev"] },
        ],
      }),
    ).rejects.toThrow(/failed to fetch/i);
  });
});
