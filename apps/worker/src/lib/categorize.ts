// Phase 1 rule-based categorizer (blueprint §8 v1 + §6 pipeline step 3).
// AI fallback for low-confidence items arrives in phase 6.

export interface TopicMatch {
  topicKey: string;
  confidence: number;
}

const KEYWORDS: Record<string, string[]> = {
  ai: [
    "artificial intelligence", "machine learning", "deep learning", "neural network",
    "llm", "llms", "gpt", "openai", "anthropic", "claude", "gemini", "chatbot",
    "generative ai", "diffusion model", "deepmind", "ai model", "ai startup", "agentic",
    "llama", "mistral", "hugging face", "huggingface", "sora", "reasoning model",
    "transformer", "fine-tuning", "rag", "vector database", "cuda", "blackwell",
    "pytorch", "tensorflow", "computer vision", "multimodal",
  ],
  webdev: [
    "javascript", "typescript", "react", "next.js", "vue", "angular", "svelte",
    "css", "html", "node.js", "frontend", "backend", "full stack", "full-stack",
    "web app", "web development", "browser", "graphql", "vite", "turbopack",
    "server components", "rsc", "bun", "deno", "astro", "tailwind", "prisma",
    "drizzle", "trpc", "remix", "laravel", "php", "webassembly", "wasm",
  ],
  mobile: [
    "android", "ios", "iphone", "ipad", "react native", "flutter", "kotlin",
    "swiftui", "swift", "mobile app", "play store", "app store", "expo",
    "visionos", "jetpack compose", "pwa",
  ],
  devops: [
    "kubernetes", "docker", "terraform", "devops", "ci/cd", "aws", "azure",
    "google cloud", "serverless", "microservices", "sre", "infrastructure",
    "cloudflare", "edge computing", "container", "helm", "prometheus", "grafana",
    "istio", "kafka", "redis", "distributed systems", "linux", "ubuntu",
  ],
  cybersecurity: [
    "cybersecurity", "vulnerability", "zero-day", "cve", "data breach", "malware",
    "ransomware", "phishing", "exploit", "hacking", "security patch", "botnet",
    "spyware", "cisa", "zero trust", "threat intelligence", "infosec", "ddos",
  ],
  startups: [
    "startup", "startups", "funding round", "seed round", "series a", "series b",
    "venture capital", "unicorn", "y combinator", "founder", "founders",
    "valuation", "acquisition", "ipo", "angel investor",
  ],
  gadgets: [
    "smartphone", "laptop", "tablet", "smartwatch", "earbuds", "headphones",
    "camera", "gadget", "chipset", "snapdragon", "processor", "graphics card",
    "gpu", "foldable", "apple silicon", "m1", "m2", "m3", "m4", "copilot+",
    "snapdragon x", "oled", "intel core", "amd ryzen",
  ],
  science: [
    "nasa", "isro", "space mission", "satellite", "astronomy", "telescope",
    "physics", "biology", "quantum computing", "mars", "researchers",
    "scientific", "arxiv",
  ],
  gaming: [
    "gaming", "video game", "playstation", "xbox", "nintendo", "steam deck",
    "esports", "game developer", "gameplay", "unreal engine", "unity engine",
  ],
  crypto: [
    "bitcoin", "ethereum", "crypto", "blockchain", "web3", "nft", "defi",
    "stablecoin", "token sale", "coinbase", "binance", "solana",
  ],
  opensource: [
    "open source", "open-source", "opensource", "foss", "free software",
    "gpl", "mit license", "apache", "linux foundation", "rust", "golang",
  ],
  design: [
    "ux design", "ui design", "figma", "figjam", "design system", "typography",
    "wireframe", "accessibility", "user experience", "interaction design",
    "product design", "design tokens",
  ],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const COMPILED = Object.entries(KEYWORDS).map(([topicKey, words]) => ({
  topicKey,
  regexes: words.map((w) => new RegExp(`\\b${escapeRe(w)}\\b`, "i")),
}));

/**
 * Keyword hits over the given text, boosted/extended by connector hints.
 * Returns at most 3 topic matches, best first.
 */
export function categorize(text: string, hints: string[] = []): TopicMatch[] {
  const scores = new Map<string, number>();
  for (const { topicKey, regexes } of COMPILED) {
    let hits = 0;
    for (const re of regexes) if (re.test(text)) hits += 1;
    if (hits > 0) scores.set(topicKey, hits);
  }
  const ranked: TopicMatch[] = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topicKey, hits]) => ({ topicKey, confidence: Math.min(0.9, 0.4 + hits * 0.1) }));

  for (const hint of hints) {
    const existing = ranked.find((m) => m.topicKey === hint);
    if (existing) existing.confidence = Math.max(existing.confidence, 0.95);
    else ranked.unshift({ topicKey: hint, confidence: 0.95 });
  }
  return ranked.slice(0, 3);
}

const TAG_KEYWORDS: Record<string, string[]> = {
  openai: ["openai", "chatgpt", "gpt-4", "gpt-5", "o1", "o3"],
  llm: ["llm", "llms", "large language model"],
  claude: ["claude", "anthropic"],
  gemini: ["gemini", "bard"],
  deepmind: ["deepmind"],
  rag: ["rag", "retrieval augmented generation", "vector search"],
  pytorch: ["pytorch"],
  mistral: ["mistral"],
  huggingface: ["hugging face", "huggingface"],
  agentic: ["agentic", "ai agent", "ai agents", "autonomous agent"],
  react: ["react", "react.js", "reactjs"],
  nextjs: ["next.js", "nextjs"],
  typescript: ["typescript"],
  javascript: ["javascript", "js", "ecmascript"],
  vue: ["vue", "vue.js", "vuejs"],
  svelte: ["svelte", "sveltekit"],
  tailwind: ["tailwind", "tailwindcss"],
  nodejs: ["node.js", "nodejs"],
  bun: ["bun", "bun.sh"],
  graphql: ["graphql"],
  "react-native": ["react native", "react-native"],
  flutter: ["flutter"],
  ios: ["ios", "iphone", "ipad", "swiftui"],
  android: ["android", "jetpack compose"],
  swift: ["swift"],
  kotlin: ["kotlin"],
  expo: ["expo"],
  kubernetes: ["kubernetes", "k8s"],
  docker: ["docker", "dockerfile", "containerd"],
  aws: ["aws", "amazon web services", "lambda", "s3", "ec2"],
  cloudflare: ["cloudflare", "workers", "r2"],
  terraform: ["terraform", "opentofu"],
  linux: ["linux", "ubuntu", "debian", "arch linux", "kernel"],
  vulnerability: ["vulnerability", "cve", "security flaw"],
  "zero-day": ["zero-day", "0-day", "zero day"],
  ransomware: ["ransomware"],
  infosec: ["infosec", "cyber attack", "data breach"],
  funding: ["funding round", "seed round", "series a", "series b", "series c"],
  "venture-capital": ["venture capital", "vc fund", "vc firm"],
  ycombinator: ["y combinator", "ycombinator", "yc w2", "yc s2"],
  rust: ["rust", "rustlang"],
  golang: ["golang", "go language"],
  python: ["python", "python3"],
  figma: ["figma", "figjam"],
  ux: ["ux design", "user experience", "wireframe"],
};

const COMPILED_TAGS = Object.entries(TAG_KEYWORDS).map(([tagKey, words]) => ({
  tagKey,
  regexes: words.map((w) => new RegExp(`\\b${escapeRe(w)}\\b`, "i")),
}));

/**
 * Extracts recognized tag keys from text based on keyword matches.
 * Returns at most 5 unique tags.
 */
export function extractTags(text: string): string[] {
  const matchedTags: string[] = [];
  for (const { tagKey, regexes } of COMPILED_TAGS) {
    if (regexes.some((re) => re.test(text))) {
      matchedTags.push(tagKey);
      if (matchedTags.length >= 5) break;
    }
  }
  return matchedTags;
}
