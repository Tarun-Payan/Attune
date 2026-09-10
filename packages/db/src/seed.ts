import { eq, inArray } from "drizzle-orm";
import { db, client } from "./client";
import { interactions, items, itemTopics, sources, syncRuns, systemSettings, tags, topics } from "./schema";

// The 12 approved default topics (blueprint §21, decision #3)
const TOPICS = [
  { key: "ai", name: "Artificial Intelligence", icon: "BrainCircuit" },
  { key: "webdev", name: "Web Development", icon: "Code" },
  { key: "mobile", name: "Mobile Development", icon: "Smartphone" },
  { key: "devops", name: "DevOps & Cloud", icon: "CloudCog" },
  { key: "cybersecurity", name: "Cybersecurity", icon: "ShieldCheck" },
  { key: "startups", name: "Startups & Funding", icon: "Rocket" },
  { key: "gadgets", name: "Gadgets & Hardware", icon: "Cpu" },
  { key: "science", name: "Science", icon: "FlaskConical" },
  { key: "gaming", name: "Gaming", icon: "Gamepad2" },
  { key: "crypto", name: "Crypto & Web3", icon: "Bitcoin" },
  { key: "opensource", name: "Open Source", icon: "GitFork" },
  { key: "design", name: "Product Design", icon: "Palette" },
];

const DEFAULT_TAGS: { key: string; name: string; topicKey: string }[] = [
  // AI
  { key: "openai", name: "OpenAI", topicKey: "ai" },
  { key: "llm", name: "LLMs", topicKey: "ai" },
  { key: "claude", name: "Claude", topicKey: "ai" },
  { key: "gemini", name: "Gemini", topicKey: "ai" },
  { key: "deepmind", name: "DeepMind", topicKey: "ai" },
  { key: "rag", name: "RAG", topicKey: "ai" },
  { key: "pytorch", name: "PyTorch", topicKey: "ai" },
  { key: "mistral", name: "Mistral", topicKey: "ai" },
  { key: "huggingface", name: "Hugging Face", topicKey: "ai" },
  { key: "agentic", name: "AI Agents", topicKey: "ai" },
  // WebDev
  { key: "react", name: "React", topicKey: "webdev" },
  { key: "nextjs", name: "Next.js", topicKey: "webdev" },
  { key: "typescript", name: "TypeScript", topicKey: "webdev" },
  { key: "javascript", name: "JavaScript", topicKey: "webdev" },
  { key: "vue", name: "Vue", topicKey: "webdev" },
  { key: "svelte", name: "Svelte", topicKey: "webdev" },
  { key: "tailwind", name: "Tailwind CSS", topicKey: "webdev" },
  { key: "nodejs", name: "Node.js", topicKey: "webdev" },
  { key: "bun", name: "Bun", topicKey: "webdev" },
  { key: "graphql", name: "GraphQL", topicKey: "webdev" },
  // Mobile
  { key: "react-native", name: "React Native", topicKey: "mobile" },
  { key: "flutter", name: "Flutter", topicKey: "mobile" },
  { key: "ios", name: "iOS", topicKey: "mobile" },
  { key: "android", name: "Android", topicKey: "mobile" },
  { key: "swift", name: "Swift", topicKey: "mobile" },
  { key: "kotlin", name: "Kotlin", topicKey: "mobile" },
  { key: "expo", name: "Expo", topicKey: "mobile" },
  // DevOps
  { key: "kubernetes", name: "Kubernetes", topicKey: "devops" },
  { key: "docker", name: "Docker", topicKey: "devops" },
  { key: "aws", name: "AWS", topicKey: "devops" },
  { key: "cloudflare", name: "Cloudflare", topicKey: "devops" },
  { key: "terraform", name: "Terraform", topicKey: "devops" },
  { key: "linux", name: "Linux", topicKey: "devops" },
  // Cybersecurity
  { key: "vulnerability", name: "Vulnerability", topicKey: "cybersecurity" },
  { key: "zero-day", name: "Zero Day", topicKey: "cybersecurity" },
  { key: "ransomware", name: "Ransomware", topicKey: "cybersecurity" },
  { key: "infosec", name: "InfoSec", topicKey: "cybersecurity" },
  // Startups
  { key: "funding", name: "Funding", topicKey: "startups" },
  { key: "venture-capital", name: "Venture Capital", topicKey: "startups" },
  { key: "ycombinator", name: "Y Combinator", topicKey: "startups" },
  // OpenSource
  { key: "rust", name: "Rust", topicKey: "opensource" },
  { key: "golang", name: "Go", topicKey: "opensource" },
  { key: "python", name: "Python", topicKey: "opensource" },
  // Design
  { key: "figma", name: "Figma", topicKey: "design" },
  { key: "ux", name: "UX Design", topicKey: "design" },
];

// India-weighted default sources (blueprint §3). All free; URLs editable later in admin.
// India-weighted default sources & verified official technology industry sources.
const SOURCES: {
  name: string;
  type: "RSS" | "GITHUB_TRENDING" | "GITHUB_RELEASES" | "HACKERNEWS" | "REDDIT" | "YOUTUBE" | "DEVTO" | "PRODUCTHUNT" | "BLUESKY";
  config: Record<string, unknown>;
  credibility: number;
}[] = [
  // ── India pack (English) ────────────────────────────────────────────────
  { name: "Google News – Technology (India)", type: "RSS", credibility: 4, config: { url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en" } },
  { name: "Google News – AI (India)", type: "RSS", credibility: 4, config: { url: "https://news.google.com/rss/search?q=artificial+intelligence+when:2d&hl=en-IN&gl=IN&ceid=IN:en" } },
  { name: "Google News – Startups (India)", type: "RSS", credibility: 4, config: { url: "https://news.google.com/rss/search?q=indian+startups+funding+when:3d&hl=en-IN&gl=IN&ceid=IN:en" } },
  { name: "The Hindu – Sci-Tech", type: "RSS", credibility: 4, config: { url: "https://www.thehindu.com/sci-tech/feeder/default.rss" } },
  { name: "Times of India – Tech", type: "RSS", credibility: 3, config: { url: "https://timesofindia.indiatimes.com/rssfeeds/66949542.cms" } },
  { name: "Economic Times – Tech", type: "RSS", credibility: 4, config: { url: "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms" } },
  { name: "YourStory", type: "RSS", credibility: 3, config: { url: "https://yourstory.com/feed" } },
  { name: "Inc42", type: "RSS", credibility: 3, config: { url: "https://inc42.com/feed/" } },
  { name: "Medianama", type: "RSS", credibility: 3, config: { url: "https://www.medianama.com/feed/" } },
  { name: "Moneycontrol – Tech", type: "RSS", credibility: 3, config: { url: "https://www.moneycontrol.com/rss/technology.xml" } },
  { name: "Firstpost – Tech", type: "RSS", credibility: 3, config: { url: "https://www.firstpost.com/rss/tech.xml" } },

  // ── Global Journalism & Community ───────────────────────────────────────
  { name: "TechCrunch", type: "RSS", credibility: 4, config: { url: "https://techcrunch.com/feed/" } },
  { name: "The Verge", type: "RSS", credibility: 4, config: { url: "https://www.theverge.com/rss/index.xml" } },
  { name: "Ars Technica", type: "RSS", credibility: 4, config: { url: "https://feeds.arstechnica.com/arstechnica/index" } },
  { name: "VentureBeat", type: "RSS", credibility: 3, config: { url: "https://venturebeat.com/feed/" } },
  { name: "GitHub – Trending Repos", type: "GITHUB_TRENDING", credibility: 5, config: { languages: ["typescript", "javascript", "python", "rust", "go"] } },
  { name: "GitHub – Release Tracker", type: "GITHUB_RELEASES", credibility: 5, config: { repos: ["vercel/next.js", "facebook/react-native", "nodejs/node", "denoland/deno", "rust-lang/rust"] } },
  { name: "Hacker News – Front Page", type: "HACKERNEWS", credibility: 4, config: {} },
  { name: "Reddit – Hot Posts", type: "REDDIT", credibility: 3, config: { subreddits: ["technology", "programming", "artificial", "webdev", "androiddev", "machinelearning"] } },
  { name: "Dev.to – Top Articles", type: "DEVTO", credibility: 3, config: {} },
  { name: "Product Hunt – Today's Launches", type: "PRODUCTHUNT", credibility: 3, config: {} },
  { name: "Bluesky – Tech Search", type: "BLUESKY", credibility: 2, config: { searchTerms: ["AI", "web development", "startup india"] } },

  // ── Official Company Multi-Feed Ecosystems (Hybrid Packs) ───────────────
  {
    name: "OpenAI Official",
    type: "RSS",
    credibility: 5,
    config: {
      feeds: [
        { name: "OpenAI News", url: "https://openai.com/news/rss.xml", topicHints: ["ai", "science"] },
        { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", topicHints: ["ai"] },
      ],
    },
  },
  {
    name: "Google DeepMind & AI Research",
    type: "RSS",
    credibility: 5,
    config: {
      feeds: [
        { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", topicHints: ["ai", "science"] },
        { name: "Google Research", url: "https://research.google/blog/rss/", topicHints: ["ai", "science"] },
        { name: "Google Technology AI", url: "https://blog.google/technology/ai/rss/", topicHints: ["ai", "science"] },
      ],
    },
  },
  {
    name: "Google for Developers",
    type: "RSS",
    credibility: 5,
    config: {
      feeds: [
        { name: "Google Developers Blog", url: "https://developers.googleblog.com/atom.xml", topicHints: ["webdev", "mobile", "ai"] },
        { name: "Google Tech Developers", url: "https://blog.google/technology/developers/rss/", topicHints: ["webdev", "opensource"] },
      ],
    },
  },
  {
    name: "Meta Tech & Research",
    type: "RSS",
    credibility: 5,
    config: {
      feeds: [
        { name: "Meta Engineering", url: "https://engineering.fb.com/feed/", topicHints: ["devops", "ai", "opensource"] },
        { name: "Meta AI Research (FAIR)", url: "https://engineering.fb.com/category/ai-research/feed/", topicHints: ["ai", "science"] },
      ],
    },
  },
  {
    name: "AWS Official Feeds",
    type: "RSS",
    credibility: 5,
    config: {
      feeds: [
        { name: "AWS Official Blog", url: "https://aws.amazon.com/blogs/aws/feed/", topicHints: ["devops", "ai"] },
        { name: "AWS Developer Tools", url: "https://aws.amazon.com/blogs/developer/feed/", topicHints: ["devops", "webdev"] },
        { name: "AWS What's New", url: "https://aws.amazon.com/about-aws/whats-new/recent/feed/", topicHints: ["devops"] },
      ],
    },
  },
  {
    name: "Microsoft Dev & Platforms",
    type: "RSS",
    credibility: 5,
    config: {
      feeds: [
        { name: "Microsoft DevBlogs", url: "https://devblogs.microsoft.com/feed/", topicHints: ["webdev", "devops"] },
        { name: "Microsoft .NET Blog", url: "https://devblogs.microsoft.com/dotnet/feed/", topicHints: ["webdev", "opensource"] },
        { name: "Microsoft TypeScript Blog", url: "https://devblogs.microsoft.com/typescript/feed/", topicHints: ["webdev", "opensource"] },
        { name: "Windows Blogs", url: "https://blogs.windows.com/feed/", topicHints: ["gadgets", "ai"] },
        { name: "Microsoft 365 Dev", url: "https://devblogs.microsoft.com/microsoft365dev/feed/", topicHints: ["webdev", "devops"] },
      ],
    },
  },
  {
    name: "Docker Official",
    type: "RSS",
    credibility: 5,
    config: {
      feeds: [
        { name: "Docker Blog", url: "https://www.docker.com/blog/feed/", topicHints: ["devops", "opensource"] },
        { name: "Docker Newsroom", url: "https://www.docker.com/blog/category/newsroom/feed/", topicHints: ["devops", "startups"] },
      ],
    },
  },
  {
    name: "Node.js Official",
    type: "RSS",
    credibility: 5,
    config: {
      feeds: [
        { name: "Node.js Blog", url: "https://nodejs.org/en/feed/blog.xml", topicHints: ["webdev", "opensource"] },
      ],
    },
  },
  {
    name: "Ubuntu & Canonical",
    type: "RSS",
    credibility: 5,
    config: {
      feeds: [
        { name: "Ubuntu Blog", url: "https://ubuntu.com/blog/feed", topicHints: ["devops", "opensource"] },
        { name: "Ubuntu News", url: "https://ubuntu.com/blog/feed?tag=news", topicHints: ["devops", "cybersecurity"] },
      ],
    },
  },
  {
    name: "GitHub Official Blogs",
    type: "RSS",
    credibility: 5,
    config: {
      feeds: [
        { name: "GitHub Blog", url: "https://github.blog/feed/", topicHints: ["webdev", "opensource", "ai"] },
        { name: "GitHub Changelog", url: "https://github.blog/changelog/feed/", topicHints: ["devops", "opensource"] },
      ],
    },
  },
  {
    name: "Figma Official",
    type: "RSS",
    credibility: 4,
    config: {
      feeds: [
        { name: "Figma Blog", url: "https://www.figma.com/blog/feed/atom.xml", topicHints: ["design", "webdev"] },
      ],
    },
  },

  // ── Standalone Major Frameworks & Platforms ─────────────────────────────
  { name: "React Official Blog", type: "RSS", credibility: 5, config: { url: "https://react.dev/rss.xml", topicHints: ["webdev", "opensource"] } },
  { name: "Next.js Official Blog", type: "RSS", credibility: 5, config: { url: "https://nextjs.org/feed.xml", topicHints: ["webdev", "opensource"] } },
  { name: "Vercel Blog", type: "RSS", credibility: 4, config: { url: "https://vercel.com/atom", topicHints: ["webdev", "ai"] } },
  { name: "Netlify Blog", type: "RSS", credibility: 4, config: { url: "https://www.netlify.com/feed.xml", topicHints: ["webdev", "devops"] } },
  { name: "Hostinger Blog", type: "RSS", credibility: 3, config: { url: "https://www.hostinger.com/blog/feed/", topicHints: ["webdev", "devops"] } },
  { name: "Laravel News", type: "RSS", credibility: 4, config: { url: "https://laravel-news.com/feed", topicHints: ["webdev", "opensource"] } },
  { name: "Netflix TechBlog", type: "RSS", credibility: 5, config: { url: "https://netflixtechblog.com/feed", topicHints: ["devops", "webdev"] } },
  { name: "Apple Newsroom", type: "RSS", credibility: 4, config: { url: "https://www.apple.com/newsroom/rss-feed.rss", topicHints: ["gadgets", "mobile"] } },
  { name: "VS Code Official Blog", type: "RSS", credibility: 5, config: { url: "https://code.visualstudio.com/feed.xml", topicHints: ["webdev", "opensource", "devops"] } },

  // ── High-Impact Official Tech & Research Additions ──────────────────────
  { name: "Hugging Face Blog", type: "RSS", credibility: 5, config: { url: "https://huggingface.co/blog/feed.xml", topicHints: ["ai", "opensource"] } },
  { name: "arXiv AI & Machine Learning Papers", type: "RSS", credibility: 5, config: { url: "https://rss.arxiv.org/rss/cs.AI+cs.LG", topicHints: ["ai", "science"] } },
  { name: "Cloudflare Blog", type: "RSS", credibility: 5, config: { url: "https://blog.cloudflare.com/rss/", topicHints: ["devops", "cybersecurity", "webdev"] } },
  { name: "Kubernetes Official Blog", type: "RSS", credibility: 5, config: { url: "https://kubernetes.io/feed.xml", topicHints: ["devops", "opensource"] } },
  { name: "Rust Language Blog", type: "RSS", credibility: 5, config: { url: "https://blog.rust-lang.org/feed.xml", topicHints: ["opensource", "devops"] } },
  { name: "Go Dev Blog", type: "RSS", credibility: 5, config: { url: "https://go.dev/blog/feed.atom", topicHints: ["webdev", "devops", "opensource"] } },
  { name: "Python Insider", type: "RSS", credibility: 5, config: { url: "https://pythoninsider.blogspot.com/feeds/posts/default", topicHints: ["opensource", "ai"] } },
  { name: "Web.dev by Google Chrome", type: "RSS", credibility: 5, config: { url: "https://web.dev/feed.xml", topicHints: ["webdev", "design"] } },
  { name: "Discord Engineering", type: "RSS", credibility: 4, config: { url: "https://discord.com/blog/rss.xml", topicHints: ["devops", "webdev"] } },
  { name: "Slack Engineering", type: "RSS", credibility: 4, config: { url: "https://slack.engineering/feed/", topicHints: ["devops", "webdev"] } },
  { name: "Dropbox Tech Blog", type: "RSS", credibility: 4, config: { url: "https://dropbox.tech/feed", topicHints: ["devops", "webdev"] } },
  { name: "Google Project Zero", type: "RSS", credibility: 5, config: { url: "https://googleprojectzero.blogspot.com/feeds/posts/default", topicHints: ["cybersecurity", "science"] } },
  { name: "The Hacker News", type: "RSS", credibility: 4, config: { url: "https://feeds.feedburner.com/TheHackersNews", topicHints: ["cybersecurity"] } },
  { name: "NVIDIA Developer Blog", type: "RSS", credibility: 5, config: { url: "https://developer.nvidia.com/blog/feed", topicHints: ["ai", "gadgets"] } },
  {
    name: "YouTube",
    type: "YOUTUBE",
    credibility: 4,
    config: {
      channels: [
        // ── Original & Tech Giants ──────────────────────────────────────────
        { name: "Fireship", id: "UCsBjURrPoezykLs9EqgamOA", topicHints: ["webdev", "ai"] },
        { name: "Microsoft", id: "UCFtEEv80fQVKkD4h1PF-Xqw", topicHints: ["devops", "webdev", "ai"] },
        { name: "AWS Events", id: "UCdoadna9HFHsxXWhafhNvKw", topicHints: ["devops"] },
        { name: "Amazon Web Services", id: "UCd6MoB9NC6uYN2grvUNT-Zg", topicHints: ["devops", "ai"] },
        { name: "NVIDIA", id: "UCHuiy8bXnmK5nisYHUd1J5g", topicHints: ["ai", "gadgets"] },
        { name: "Google Cloud Tech", id: "UCTMRxtyHoE3LPcrl-kT4AQQ", topicHints: ["devops", "ai"] },
        { name: "Google", id: "UCK8sQmJBp8GCxrOtXWBpyEA", topicHints: ["ai", "webdev"] },
        { name: "Chai aur Code", id: "UCNQ6FEtztATuaVhZKCY28Yw", topicHints: ["webdev", "mobile"] },
        { name: "Piyush Garg", id: "UCf9T51_FmMlfhiGpoes0yFA", topicHints: ["webdev", "devops", "ai"] },
        // ── System Design & Architecture ────────────────────────────────────
        { name: "ByteByteGo", id: "UCZgt6AzoyjslHTC9dz0UoTw", topicHints: ["devops", "webdev"] },
        { name: "Gaurav Sen", id: "UCNXUhsYeyjxdTyayQdrZ_4Q", topicHints: ["devops", "webdev"] },
        { name: "Hussein Nasser", id: "UC_ML5xP23TOWKUcc-oAE_Eg", topicHints: ["devops", "webdev"] },
        // ── AI & Machine Learning Research ──────────────────────────────────
        { name: "Two Minute Papers", id: "UCbfYPyITQ-7l4upoX8nvctg", topicHints: ["ai", "science"] },
        { name: "Yannic Kilcher", id: "UCZHmQk67mSJgfCCTn7xBfew", topicHints: ["ai", "science"] },
        { name: "AI Explained", id: "UCNJ1Ymd5yFuUPtn21xtRbbw", topicHints: ["ai"] },
        { name: "Lex Fridman", id: "UCSHZKyawb77ixDdsGog4iWA", topicHints: ["ai", "science", "startups"] },
        // ── Modern Web & Developer Ecosystem ────────────────────────────────
        { name: "Theo - t3.gg", id: "UCbRP3c757lWg9M-U7TyEkXA", topicHints: ["webdev", "startups"] },
        { name: "ThePrimeTimeagen", id: "UCUyeluBRhGPCW4rPe_UvBZQ", topicHints: ["webdev", "opensource"] },
        { name: "Web Dev Simplified", id: "UCFbNIlppjAuEX4znoulh0Cw", topicHints: ["webdev"] },
        { name: "Kevin Powell", id: "UCJZv4d5rbIKd4QHMPkcABCw", topicHints: ["webdev", "design"] },
        { name: "freeCodeCamp.org", id: "UC8butISFwT-Wl7EV0hUK0BQ", topicHints: ["webdev", "ai", "opensource"] },
        // ── Hardware, Gadgets & Consumer Tech ───────────────────────────────
        { name: "MKBHD", id: "UCBJycsmduvYEL83R_U4JriQ", topicHints: ["gadgets"] },
        { name: "Dave2D", id: "UCVYamHliCI9rw1tHR1xbkfw", topicHints: ["gadgets"] },
        // ── Indian Tech Community & Career ──────────────────────────────────
        { name: "Engineering with Utsav", id: "UC4HiUdMwzyZhBUoNKXenO-A", topicHints: ["webdev", "startups"] },
        { name: "Harkirat Singh", id: "UCWX0cUR2rZcqKei1Vstww-A", topicHints: ["webdev", "crypto", "opensource"] },
      ],
    },
  },
  { name: "Bluesky – Tech Search", type: "BLUESKY", credibility: 2, config: { searchTerms: ["AI", "web development", "startup india"] } },
];

async function main() {
  await db.insert(topics).values(TOPICS).onConflictDoNothing();
  console.log(`Topics: ${TOPICS.length} ensured (idempotent by key)`);

  // Ensure tags linked to topics
  const dbTopics = await db.select({ id: topics.id, key: topics.key }).from(topics);
  const topicIdByKey = new Map(dbTopics.map((t) => [t.key, t.id]));

  for (const t of DEFAULT_TAGS) {
    const topicId = topicIdByKey.get(t.topicKey);
    await db
      .insert(tags)
      .values({
        key: t.key,
        name: t.name,
        topicId: topicId ?? null,
      })
      .onConflictDoNothing();
  }
  console.log(`Tags: ${DEFAULT_TAGS.length} ensured (idempotent by key)`);

  // Ensure default system settings
  await db
    .insert(systemSettings)
    .values({
      key: "general",
      value: {
        reportAutoHideThreshold: 5,
        explorationRatioPercent: 10,
        minDwellNudgeSeconds: 5,
      },
    })
    .onConflictDoNothing();
  console.log("System settings: initialized default configuration");

  // Clean up legacy "YouTube – Tech Channels" source if present from earlier runs
  const legacySources = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.name, "YouTube – Tech Channels"));

  for (const legacy of legacySources) {
    const legacyItems = await db.select({ id: items.id }).from(items).where(eq(items.sourceId, legacy.id));
    const legacyItemIds = legacyItems.map((i) => i.id);
    if (legacyItemIds.length > 0) {
      await db.delete(itemTopics).where(inArray(itemTopics.itemId, legacyItemIds));
      await db.delete(interactions).where(inArray(interactions.itemId, legacyItemIds));
      await db.delete(items).where(eq(items.sourceId, legacy.id));
    }
    await db.delete(syncRuns).where(eq(syncRuns.sourceId, legacy.id));
    await db.delete(sources).where(eq(sources.id, legacy.id));
    console.log(`Deleted legacy source "YouTube – Tech Channels" (${legacy.id})`);
  }

  const existing = await db.select({ id: sources.id, name: sources.name }).from(sources);
  const knownMap = new Map(existing.map((r) => [r.name, r.id]));

  let updatedCount = 0;
  let addedCount = 0;

  for (const s of SOURCES) {
    const existingId = knownMap.get(s.name);
    if (existingId) {
      await db
        .update(sources)
        .set({ config: s.config, credibility: s.credibility })
        .where(eq(sources.id, existingId));
      updatedCount++;
    } else {
      await db.insert(sources).values(s);
      addedCount++;
    }
  }
  console.log(`Sources: ${addedCount} added, ${updatedCount} updated (total ${SOURCES.length})`);

  await client.end();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await client.end().catch(() => undefined);
  process.exit(1);
});
