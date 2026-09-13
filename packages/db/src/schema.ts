import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  bigint,
  integer,
  real,
  timestamp,
  json,
  uniqueIndex,
  index,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { INTERACTION_TYPES, OAUTH_PROVIDERS, SOURCE_TYPES, USER_ROLES } from "@attune/types";

export const roleEnum = pgEnum("role", USER_ROLES);
export const sourceTypeEnum = pgEnum("source_type", SOURCE_TYPES);
export const interactionTypeEnum = pgEnum("interaction_type", INTERACTION_TYPES);
export const oauthProviderEnum = pgEnum("oauth_provider", OAUTH_PROVIDERS);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("token_hash").notNull().unique(), // sha256 of the opaque token
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("refresh_tokens_user_idx").on(t.userId)],
);

export const adminRoles = pgTable("admin_roles", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  name: varchar("name", { length: 64 }).notNull().unique(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminRolePermissions = pgTable(
  "admin_role_permissions",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    roleId: varchar("role_id")
      .notNull()
      .references(() => adminRoles.id, { onDelete: "cascade" }),
    feature: varchar("feature", { length: 32 }).notNull(),
    action: varchar("action", { length: 16 }).notNull(),
  },
  (t) => [
    uniqueIndex("admin_role_permissions_role_feature_action_unique").on(t.roleId, t.feature, t.action),
    index("admin_role_permissions_role_idx").on(t.roleId),
  ],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  email: varchar("email").notNull().unique(),
  passwordHash: text("password_hash"), // NULL for OAuth-only accounts
  name: varchar("name"),
  avatarUrl: text("avatar_url"),
  timezone: varchar("timezone").notNull().default("Asia/Kolkata"), // India-first
  role: roleEnum("role").notNull().default("USER"),
  adminRoleId: varchar("admin_role_id").references((): AnyPgColumn => adminRoles.id, { onDelete: "set null" }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }), // admin moderation
  totalDwellMs: bigint("total_dwell_ms", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    provider: oauthProviderEnum("provider").notNull(),
    providerAccountId: varchar("provider_account_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("accounts_provider_account_unique").on(t.provider, t.providerAccountId),
    uniqueIndex("accounts_user_provider_unique").on(t.userId, t.provider),
  ],
);

export const topics = pgTable("topics", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  key: varchar("key").notNull().unique(), // "ai", "webdev", "startups"…
  name: varchar("name").notNull(), // "Artificial Intelligence"
  icon: varchar("icon"), // emoji or icon name
  parentId: varchar("parent_id").references((): AnyPgColumn => topics.id),
});

export const sources = pgTable("sources", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  name: varchar("name").notNull(),
  type: sourceTypeEnum("type").notNull(),
  config: json("config").$type<Record<string, unknown>>().notNull(), // per-type: url/subreddit/channel…
  enabled: boolean("enabled").notNull().default(true),
  credibility: integer("credibility").notNull().default(3), // 1–5, used in ranking
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clusters = pgTable("clusters", {
  id: varchar("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const items = pgTable(
  "items",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    sourceId: varchar("source_id")
      .notNull()
      .references(() => sources.id),
    externalId: varchar("external_id").notNull(), // id at the source
    url: text("url").notNull(),
    urlHash: varchar("url_hash").notNull(), // sha256(normalized url) → dedupe key
    clusterId: varchar("cluster_id").references(() => clusters.id),
    title: text("title").notNull(),
    summary: text("summary"), // AI TL;DR (phase 6)
    content: text("content").notNull(), // cleaned text
    author: varchar("author"),
    imageUrl: text("image_url"),
    metrics: json("metrics").$type<Record<string, number>>(),
    language: varchar("language").notNull().default("en"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    hidden: boolean("hidden").notNull().default(false), // admin moderation
    likesCount: integer("likes_count").notNull().default(0),
    dislikesCount: integer("dislikes_count").notNull().default(0),
    viewsCount: integer("views_count").notNull().default(0),
    reportsCount: integer("reports_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("items_url_hash_unique").on(t.urlHash),
    uniqueIndex("items_source_external_unique").on(t.sourceId, t.externalId),
    index("items_published_at_idx").on(t.publishedAt),
    index("items_cluster_idx").on(t.clusterId),
    index("items_source_idx").on(t.sourceId),
  ],
);

export const itemTopics = pgTable(
  "item_topics",
  {
    itemId: varchar("item_id")
      .notNull()
      .references(() => items.id),
    topicId: varchar("topic_id")
      .notNull()
      .references(() => topics.id),
    confidence: real("confidence").notNull(), // 0..1
    method: varchar("method").notNull(), // "rule" | "ai"
  },
  (t) => [primaryKey({ columns: [t.itemId, t.topicId] })],
);

export const userTopics = pgTable(
  "user_topics",
  {
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    topicId: varchar("topic_id")
      .notNull()
      .references(() => topics.id),
    weight: real("weight").notNull().default(1.0),
    notify: boolean("notify").notNull().default(false),
    totalDwellMs: integer("total_dwell_ms").notNull().default(0),
    viewsCount: integer("views_count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topicId] })],
);

export const tags = pgTable(
  "tags",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    key: varchar("key").notNull().unique(), // "react", "openai", "rust"…
    name: varchar("name").notNull(),
    topicId: varchar("topic_id").references((): AnyPgColumn => topics.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tags_topic_idx").on(t.topicId)],
);

export const itemTags = pgTable(
  "item_tags",
  {
    itemId: varchar("item_id")
      .notNull()
      .references(() => items.id),
    tagId: varchar("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.tagId] }), index("item_tags_tag_idx").on(t.tagId)],
);

export const userTags = pgTable(
  "user_tags",
  {
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    tagId: varchar("tag_id")
      .notNull()
      .references(() => tags.id),
    weight: real("weight").notNull().default(1.0),
    totalDwellMs: integer("total_dwell_ms").notNull().default(0),
    viewsCount: integer("views_count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.tagId] }),
    index("user_tags_user_weight_idx").on(t.userId, t.weight),
  ],
);

export const interactions = pgTable(
  "interactions",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    itemId: varchar("item_id")
      .notNull()
      .references(() => items.id),
    type: interactionTypeEnum("type").notNull(),
    dwellMs: integer("dwell_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("interactions_user_created_idx").on(t.userId, t.createdAt)],
);

export const devices = pgTable(
  "devices",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    fcmToken: varchar("fcm_token").notNull().unique(), // push token (FCM or Expo)
    provider: varchar("provider").notNull().default("fcm"), // "fcm" | "expo"
    platform: varchar("platform").notNull(), // "android" | "ios"
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("devices_user_idx").on(t.userId)],
);

export const notificationPrefs = pgTable("notification_prefs", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => users.id),
  pushEnabled: boolean("push_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  maxPushPerHour: integer("max_push_per_hour").notNull().default(3),
});

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    itemId: varchar("item_id").references(() => items.id),
    channel: varchar("channel").notNull(), // "push" | "email"
    kind: varchar("kind").notNull(), // "topic_match" | "digest" | "campaign" | "system"
    status: varchar("status").notNull(), // "sent" | "failed" | "throttled" | "skipped"
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notification_logs_user_sent_idx").on(t.userId, t.sentAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    itemId: varchar("item_id")
      .notNull()
      .references(() => items.id),
    reason: varchar("reason").notNull(),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reports_user_item_unique").on(t.userId, t.itemId),
    index("reports_item_idx").on(t.itemId),
  ],
);

export const inAppNotifications = pgTable(
  "in_app_notifications",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    itemId: varchar("item_id").references(() => items.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    kind: varchar("kind").notNull().default("topic_match"),
    data: json("data").$type<Record<string, unknown>>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("in_app_notifications_user_idx").on(t.userId, t.createdAt),
    index("in_app_notifications_user_read_idx").on(t.userId, t.readAt),
  ],
);

export const systemSettings = pgTable("system_settings", {
  key: varchar("key").primaryKey(),
  value: json("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    sourceId: varchar("source_id")
      .notNull()
      .references(() => sources.id),
    jobId: varchar("job_id"),
    status: varchar("status").notNull(), // "ok" | "error"
    itemsFound: integer("items_found").notNull().default(0),
    itemsNew: integer("items_new").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("sync_runs_source_started_idx").on(t.sourceId, t.startedAt),
    index("sync_runs_job_id_idx").on(t.jobId),
  ],
);

export const verificationCodes = pgTable(
  "verification_codes",
  {
    id: varchar("id").primaryKey().$defaultFn(() => createId()),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email").notNull(),
    code: varchar("code", { length: 6 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(), // "EMAIL_CHANGE" | "PASSWORD_RESET"
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("verification_codes_email_type_idx").on(t.email, t.type),
    index("verification_codes_user_type_idx").on(t.userId, t.type),
  ],
);

// Convenience row types used across api/worker
export type User = typeof users.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
export type AdminRoleRecord = typeof adminRoles.$inferSelect;
export type AdminRolePermissionRecord = typeof adminRolePermissions.$inferSelect;
export type VerificationCodeRecord = typeof verificationCodes.$inferSelect;
