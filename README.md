# 📡 Attune

> **Your world, tuned in.** A personalized news & technology-update aggregator —
> minimal information, maximum usefulness.

**Status: 🚧 Phase 6 complete — AI layer (summaries, AI categorization, AI Morning Brief), implicit personalization, clustering, search, streaks. Next: Phase 7 (polish & launch).**

**Admin panel**: `cd apps/admin && pnpm dev` → http://localhost:3001.

## Quickstart

```bash
pnpm install          # install all workspace dependencies
pnpm infra:up         # Docker: Postgres :5432 · Redis :6379 · Mailpit UI :8025
pnpm db:migrate       # apply Drizzle migrations
pnpm db:seed          # seed 12 topics + 23 India-weighted sources
pnpm dev              # api (http://localhost:3000, Swagger at /docs) + worker
```

**Mobile app** (Expo Go on your phone, same Wi-Fi):

```bash
cd apps/mobile
npx expo start        # scan the QR with Expo Go (Android) or the Camera app (iOS)
```

The app auto-targets the API on your dev machine's LAN IP; set `EXPO_PUBLIC_API_URL` to override.
Demo account: `demo@attune.app` / `password123` (topics: ai, startups, webdev).

## The pitch

- **Backend** (Node.js + Fastify) continuously ingests fresh content from free public
  sources (Google News RSS, GitHub, Hacker News, Reddit, YouTube, Dev.to, Product Hunt,
  Bluesky, any RSS feed) using cron jobs + queues (BullMQ/Redis), then dedupes, clusters,
  and categorizes every item into topics.
- **Mobile app** (Expo / React Native): register, pick your topics, and scroll a calm,
  infinite feed that contains only what you chose — ranked by your taste over time.
- **Admin panel** (Next.js): manage sources, topics, users, moderation, campaigns, and
  watch the ingestion pipelines live.
- **Notifications**: Firebase push (throttled, quiet hours) + a daily AI-summarized
  "Morning Brief" email.

## The four apps

| Folder | What | Stack |
|--------|------|-------|
| `apps/api` | REST API | Fastify, Drizzle ORM, PostgreSQL |
| `apps/worker` | Cron schedulers + source connectors + processors | BullMQ, Redis |
| `apps/admin` | Admin panel | Next.js, Tailwind, shadcn/ui |
| `apps/mobile` | User app | Expo (React Native), expo-router |

*`apps/admin` is scaffolded in Phase 5 and `apps/mobile` in Phase 3 — the workspace picks them up automatically once added.*

## 📖 Documentation

- **[`docs/PROJECT_BLUEPRINT.md`](docs/PROJECT_BLUEPRINT.md)** — architecture, database design, API spec, personalization engine, roadmap, and costs.
- **[`docs/CODE_PRACTICES.md`](docs/CODE_PRACTICES.md)** — coding practices, standards, architecture patterns, and conventions across all apps and packages.

*Decisions locked: **Attune** · India-first / English MVP · email + Google + GitHub login · Drizzle ORM · Docker for local infra. Full details in [the blueprint](docs/PROJECT_BLUEPRINT.md).*
