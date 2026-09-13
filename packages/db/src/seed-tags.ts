import { sql } from "drizzle-orm";
import { db, client } from "./client";
import { tags, topics } from "./schema";

export interface TagSeedDefinition {
  key: string;
  name: string;
  topicKey: string;
}

export const DEFAULT_TAGS: TagSeedDefinition[] = [
  // ── 1. Artificial Intelligence (ai) ──────────────────────────────
  { key: "openai", name: "OpenAI", topicKey: "ai" },
  { key: "llm", name: "Large Language Models", topicKey: "ai" },
  { key: "claude", name: "Claude (Anthropic)", topicKey: "ai" },
  { key: "gemini", name: "Gemini", topicKey: "ai" },
  { key: "deepmind", name: "DeepMind", topicKey: "ai" },
  { key: "rag", name: "RAG & Vector Search", topicKey: "ai" },
  { key: "pytorch", name: "PyTorch", topicKey: "ai" },
  { key: "mistral", name: "Mistral AI", topicKey: "ai" },
  { key: "huggingface", name: "Hugging Face", topicKey: "ai" },
  { key: "agentic", name: "AI Agents", topicKey: "ai" },
  { key: "langchain", name: "LangChain", topicKey: "ai" },
  { key: "ollama", name: "Ollama", topicKey: "ai" },
  { key: "diffusion", name: "Diffusion Models", topicKey: "ai" },
  { key: "computer-vision", name: "Computer Vision", topicKey: "ai" },
  { key: "nvidia", name: "NVIDIA AI", topicKey: "ai" },

  // ── 2. Web Development (webdev) ──────────────────────────────────
  { key: "react", name: "React", topicKey: "webdev" },
  { key: "nextjs", name: "Next.js", topicKey: "webdev" },
  { key: "typescript", name: "TypeScript", topicKey: "webdev" },
  { key: "javascript", name: "JavaScript", topicKey: "webdev" },
  { key: "vue", name: "Vue.js", topicKey: "webdev" },
  { key: "svelte", name: "Svelte", topicKey: "webdev" },
  { key: "tailwind", name: "Tailwind CSS", topicKey: "webdev" },
  { key: "nodejs", name: "Node.js", topicKey: "webdev" },
  { key: "bun", name: "Bun", topicKey: "webdev" },
  { key: "graphql", name: "GraphQL", topicKey: "webdev" },
  { key: "vite", name: "Vite", topicKey: "webdev" },
  { key: "astro", name: "Astro", topicKey: "webdev" },
  { key: "angular", name: "Angular", topicKey: "webdev" },
  { key: "webassembly", name: "WebAssembly (Wasm)", topicKey: "webdev" },

  // ── 3. Mobile Development (mobile) ──────────────────────────────
  { key: "react-native", name: "React Native", topicKey: "mobile" },
  { key: "flutter", name: "Flutter", topicKey: "mobile" },
  { key: "ios", name: "iOS Development", topicKey: "mobile" },
  { key: "android", name: "Android Development", topicKey: "mobile" },
  { key: "swift", name: "Swift", topicKey: "mobile" },
  { key: "kotlin", name: "Kotlin", topicKey: "mobile" },
  { key: "expo", name: "Expo", topicKey: "mobile" },
  { key: "jetpack-compose", name: "Jetpack Compose", topicKey: "mobile" },
  { key: "swiftui", name: "SwiftUI", topicKey: "mobile" },
  { key: "pwa", name: "Progressive Web Apps", topicKey: "mobile" },

  // ── 4. DevOps & Cloud (devops) ───────────────────────────────────
  { key: "kubernetes", name: "Kubernetes", topicKey: "devops" },
  { key: "docker", name: "Docker", topicKey: "devops" },
  { key: "aws", name: "AWS", topicKey: "devops" },
  { key: "cloudflare", name: "Cloudflare", topicKey: "devops" },
  { key: "terraform", name: "Terraform", topicKey: "devops" },
  { key: "linux", name: "Linux", topicKey: "devops" },
  { key: "ci-cd", name: "CI/CD Pipelines", topicKey: "devops" },
  { key: "azure", name: "Microsoft Azure", topicKey: "devops" },
  { key: "gcp", name: "Google Cloud", topicKey: "devops" },
  { key: "serverless", name: "Serverless", topicKey: "devops" },
  { key: "microservices", name: "Microservices", topicKey: "devops" },
  { key: "prometheus", name: "Prometheus & Monitoring", topicKey: "devops" },

  // ── 5. Cybersecurity (cybersecurity) ─────────────────────────────
  { key: "vulnerability", name: "Vulnerabilities & CVE", topicKey: "cybersecurity" },
  { key: "zero-day", name: "Zero Day Exploits", topicKey: "cybersecurity" },
  { key: "ransomware", name: "Ransomware", topicKey: "cybersecurity" },
  { key: "infosec", name: "InfoSec", topicKey: "cybersecurity" },
  { key: "malware", name: "Malware Analysis", topicKey: "cybersecurity" },
  { key: "phishing", name: "Phishing", topicKey: "cybersecurity" },
  { key: "cryptography", name: "Cryptography", topicKey: "cybersecurity" },
  { key: "penetration-testing", name: "Penetration Testing", topicKey: "cybersecurity" },
  { key: "zero-trust", name: "Zero Trust", topicKey: "cybersecurity" },
  { key: "data-breach", name: "Data Breaches", topicKey: "cybersecurity" },

  // ── 6. Startups & Funding (startups) ─────────────────────────────
  { key: "funding", name: "Funding & Seed Rounds", topicKey: "startups" },
  { key: "venture-capital", name: "Venture Capital", topicKey: "startups" },
  { key: "ycombinator", name: "Y Combinator", topicKey: "startups" },
  { key: "saas", name: "SaaS", topicKey: "startups" },
  { key: "ipo", name: "IPO & Acquisitions", topicKey: "startups" },
  { key: "bootstrapping", name: "Bootstrapping", topicKey: "startups" },
  { key: "product-market-fit", name: "Product-Market Fit", topicKey: "startups" },
  { key: "fintech", name: "FinTech", topicKey: "startups" },

  // ── 7. Gadgets & Hardware (gadgets) ──────────────────────────────
  { key: "smartphones", name: "Smartphones", topicKey: "gadgets" },
  { key: "apple-silicon", name: "Apple Silicon (M-Series)", topicKey: "gadgets" },
  { key: "gpu", name: "GPUs & Graphics Cards", topicKey: "gadgets" },
  { key: "wearables", name: "Wearables & Smartwatches", topicKey: "gadgets" },
  { key: "laptops", name: "Laptops & PCs", topicKey: "gadgets" },
  { key: "iot", name: "Internet of Things (IoT)", topicKey: "gadgets" },
  { key: "vr-ar", name: "VR & AR Headsets", topicKey: "gadgets" },
  { key: "semiconductors", name: "Chips & Semiconductors", topicKey: "gadgets" },

  // ── 8. Science (science) ─────────────────────────────────────────
  { key: "space", name: "Space Exploration", topicKey: "science" },
  { key: "quantum-computing", name: "Quantum Computing", topicKey: "science" },
  { key: "physics", name: "Physics", topicKey: "science" },
  { key: "biotech", name: "Biotechnology & Genomics", topicKey: "science" },
  { key: "climate-tech", name: "Climate Tech & Clean Energy", topicKey: "science" },
  { key: "neuroscience", name: "Neuroscience", topicKey: "science" },
  { key: "robotics", name: "Robotics & Automation", topicKey: "science" },

  // ── 9. Gaming (gaming) ───────────────────────────────────────────
  { key: "unreal-engine", name: "Unreal Engine", topicKey: "gaming" },
  { key: "unity", name: "Unity Engine", topicKey: "gaming" },
  { key: "playstation", name: "PlayStation", topicKey: "gaming" },
  { key: "xbox", name: "Xbox", topicKey: "gaming" },
  { key: "nintendo", name: "Nintendo", topicKey: "gaming" },
  { key: "pc-gaming", name: "PC Gaming & Steam", topicKey: "gaming" },
  { key: "esports", name: "Esports", topicKey: "gaming" },
  { key: "game-dev", name: "Game Development", topicKey: "gaming" },

  // ── 10. Crypto & Web3 (crypto) ───────────────────────────────────
  { key: "bitcoin", name: "Bitcoin", topicKey: "crypto" },
  { key: "ethereum", name: "Ethereum", topicKey: "crypto" },
  { key: "solana", name: "Solana", topicKey: "crypto" },
  { key: "defi", name: "DeFi", topicKey: "crypto" },
  { key: "smart-contracts", name: "Smart Contracts", topicKey: "crypto" },
  { key: "web3", name: "Web3 Ecosystem", topicKey: "crypto" },
  { key: "stablecoins", name: "Stablecoins", topicKey: "crypto" },
  { key: "layer2", name: "Layer 2 & Rollups", topicKey: "crypto" },

  // ── 11. Open Source (opensource) ─────────────────────────────────
  { key: "rust", name: "Rust", topicKey: "opensource" },
  { key: "golang", name: "Go", topicKey: "opensource" },
  { key: "python", name: "Python", topicKey: "opensource" },
  { key: "git", name: "Git & GitHub", topicKey: "opensource" },
  { key: "linux-kernel", name: "Linux Kernel", topicKey: "opensource" },
  { key: "foss", name: "FOSS & Licensing", topicKey: "opensource" },
  { key: "devtools", name: "Developer Tools", topicKey: "opensource" },

  // ── 12. Product Design (design) ──────────────────────────────────
  { key: "figma", name: "Figma", topicKey: "design" },
  { key: "ux", name: "UX Design & Research", topicKey: "design" },
  { key: "ui", name: "UI Design & Visuals", topicKey: "design" },
  { key: "design-systems", name: "Design Systems", topicKey: "design" },
  { key: "interaction-design", name: "Interaction Design", topicKey: "design" },
  { key: "accessibility", name: "Accessibility (a11y)", topicKey: "design" },
  { key: "typography", name: "Typography", topicKey: "design" },
];

/**
 * Idempotently seeds or updates tags for all existing topics.
 */
export async function seedTags(database = db) {
  const dbTopics = await database.select({ id: topics.id, key: topics.key }).from(topics);
  const topicIdByKey = new Map(dbTopics.map((t) => [t.key, t.id]));

  if (dbTopics.length === 0) {
    console.warn("⚠️ Warning: No topics found in database. Run topic seeds first!");
    return { inserted: 0, updated: 0, total: 0 };
  }

  let processed = 0;
  for (const t of DEFAULT_TAGS) {
    const topicId = topicIdByKey.get(t.topicKey);
    if (!topicId) {
      console.warn(`⚠️ Warning: Topic key "${t.topicKey}" not found in database for tag "${t.key}".`);
      continue;
    }

    await database
      .insert(tags)
      .values({
        key: t.key,
        name: t.name,
        topicId: topicId,
      })
      .onConflictDoUpdate({
        target: tags.key,
        set: {
          name: sql`excluded.name`,
          topicId: sql`excluded.topic_id`,
        },
      });

    processed++;
  }

  console.log(`✅ Default tags seeded: ${processed} tags ensured across ${topicIdByKey.size} topics (idempotent upsert by key).`);
  return { processed, total: DEFAULT_TAGS.length };
}

async function run() {
  try {
    await seedTags();
  } catch (err) {
    console.error("❌ Tag seeding failed:", err);
    process.exit(1);
  } finally {
    await client.end().catch(() => undefined);
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith("seed-tags.ts") || process.argv[1]?.endsWith("seed-tags.js")) {
  run();
}
