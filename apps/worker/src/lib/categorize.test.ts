import { describe, expect, it } from "vitest";
import { categorize, extractTags } from "./categorize";

describe("categorize (rule engine)", () => {
  it("tags an AI story with ai", () => {
    const matches = categorize("OpenAI launches new GPT model for developers");
    expect(matches[0]?.topicKey).toBe("ai");
    expect(matches[0]?.confidence).toBeGreaterThan(0.4);
  });

  it("does not match 'ai' inside other words (word boundaries)", () => {
    const matches = categorize("How to train for a marathon in the rain and remain sane");
    expect(matches.map((m) => m.topicKey)).not.toContain("ai");
  });

  it("matches multiple topics and ranks the strongest first", () => {
    const matches = categorize(
      "AI startup raises $50M seed round to build machine learning infrastructure",
    );
    expect(matches.length).toBeGreaterThan(1);
    expect(matches[0]?.topicKey).toBe("ai"); // most keyword hits
    expect(matches.some((m) => m.topicKey === "startups")).toBe(true);
  });

  it("caps at 3 topics", () => {
    const text =
      "AI machine learning docker kubernetes startup funding bitcoin crypto gaming playstation";
    expect(categorize(text).length).toBeLessThanOrEqual(3);
  });

  it("applies connector hints at high confidence", () => {
    const matches = categorize("Some random untagged headline from r/machinelearning", ["ai"]);
    expect(matches[0]).toEqual({ topicKey: "ai", confidence: 0.95 });
  });

  it("recognizes modern AI and framework keywords like llama, turbopack, and cloudflare", () => {
    const aiMatch = categorize("Meta releases Llama 3 weights with PyTorch support");
    expect(aiMatch[0]?.topicKey).toBe("ai");

    const webMatch = categorize("Next.js introduces Turbopack and server components");
    expect(webMatch[0]?.topicKey).toBe("webdev");

    const devopsMatch = categorize("Deploying serverless workers on Cloudflare edge computing");
    expect(devopsMatch[0]?.topicKey).toBe("devops");
  });

  it("returns empty for unrelated text", () => {
    expect(categorize("Local bakery wins bread contest")).toEqual([]);
  });
});

describe("extractTags", () => {
  it("extracts micro entities such as react, typescript, and openai", () => {
    const tags = extractTags("Building an agentic OpenAI bot with React and TypeScript");
    expect(tags).toContain("openai");
    expect(tags).toContain("react");
    expect(tags).toContain("typescript");
    expect(tags).toContain("agentic");
  });

  it("returns empty array when no tags match", () => {
    expect(extractTags("Nothing relevant here")).toEqual([]);
  });
});

