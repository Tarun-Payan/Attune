import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  adminAuthResponseSchema,
  adminDashboardStatsResponseSchema,
  adminItemsListResponseSchema,
  adminItemsQuerySchema,
  adminLoginSchema,
  adminMeResponseSchema,
  adminRoleDetailResponseSchema,
  adminRolesResponseSchema,
  adminTagsResponseSchema,
  adminTopicsListResponseSchema,
  adminUsersListResponseSchema,
  adminUsersQuerySchema,
  cacheKeyDetailResponseSchema,
  cacheKeyParamSchema,
  cacheKeysListResponseSchema,
  cacheKeysQuerySchema,
  cacheOverviewResponseSchema,
  campaignQueuedResponseSchema,
  campaignSchema,
  campaignSendsResponseSchema,
  campaignsQuerySchema,
  clearCacheInputSchema,
  clearCacheResponseSchema,
  deleteCacheKeyResponseSchema,
  idParamSchema,
  itemPatchSchema,
  patchSystemSettingsSchema,
  roleCreateSchema,
  rolePatchSchema,
  sourceCreateSchema,
  sourcePatchSchema,
  sourceSchema,
  sourcesListResponseSchema,
  syncRunsListResponseSchema,
  syncRunsQuerySchema,
  systemSettingsResponseSchema,
  tagCreateSchema,
  tagPatchSchema,
  tagSchema,
  topicCreateSchema,
  topicPatchSchema,
  topicSchema,
  triggerSourceRunResponseSchema,
  userAssignRoleSchema,
  userPatchSchema,
} from "@attune/schemas";
import { adminController, roleController } from "../controller";
import { requireAdmin, requirePermission } from "../plugins/auth-guard";

export async function adminRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // ── Admin Authentication (Email + Password) ──────────────────────────────
  app.post(
    "/v1/admin/auth/login",
    {
      schema: {
        tags: ["admin-auth"],
        summary: "Admin Login with email & password (requires assigned admin role)",
        body: adminLoginSchema,
        response: {
          200: adminAuthResponseSchema,
        },
      },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    roleController.login,
  );

  // Guard remaining admin routes with requireAdmin (validates Bearer token + assigned admin role)
  app.addHook("preHandler", requireAdmin);

  app.get(
    "/v1/admin/auth/me",
    {
      schema: {
        tags: ["admin-auth"],
        summary: "Get current admin user profile and permissions",
        response: {
          200: adminMeResponseSchema,
        },
      },
    },
    roleController.getMe,
  );

  // ── Roles & Permissions Management ───────────────────────────────────────
  app.get(
    "/v1/admin/roles",
    {
      preHandler: requirePermission("roles", "read"),
      schema: {
        tags: ["admin-roles"],
        summary: "List all administrative roles with their permissions",
        response: {
          200: adminRolesResponseSchema,
        },
      },
    },
    roleController.listRoles,
  );

  app.get(
    "/v1/admin/roles/:id",
    {
      preHandler: requirePermission("roles", "read"),
      schema: {
        tags: ["admin-roles"],
        summary: "Get role details and permissions by ID",
        params: idParamSchema,
        response: {
          200: adminRoleDetailResponseSchema,
        },
      },
    },
    roleController.getRole,
  );

  app.post(
    "/v1/admin/roles",
    {
      preHandler: requirePermission("roles", "create"),
      schema: {
        tags: ["admin-roles"],
        summary: "Create a new administrative role with permissions",
        body: roleCreateSchema,
        response: {
          201: adminRoleDetailResponseSchema,
        },
      },
    },
    roleController.createRole,
  );

  app.patch(
    "/v1/admin/roles/:id",
    {
      preHandler: requirePermission("roles", "update"),
      schema: {
        tags: ["admin-roles"],
        summary: "Update an administrative role (name, description, permissions)",
        params: idParamSchema,
        body: rolePatchSchema,
        response: {
          200: adminRoleDetailResponseSchema,
        },
      },
    },
    roleController.updateRole,
  );

  app.delete(
    "/v1/admin/roles/:id",
    {
      preHandler: requirePermission("roles", "write"),
      schema: {
        tags: ["admin-roles"],
        summary: "Delete a custom administrative role",
        params: idParamSchema,
        response: {
          200: z.object({ deleted: z.boolean() }),
        },
      },
    },
    roleController.deleteRole,
  );

  app.patch(
    "/v1/admin/users/:id/role",
    {
      preHandler: requirePermission("roles", "write"),
      schema: {
        tags: ["admin-roles"],
        summary: "Assign or revoke a user's administrative role",
        params: idParamSchema,
        body: userAssignRoleSchema,
        response: {
          200: z.object({
            user: z.object({
              id: z.string(),
              adminRoleId: z.string().nullable(),
            }),
          }),
        },
      },
    },
    roleController.assignUserRole,
  );

  // ── Dashboard Stats ───────────────────────────────────────────────────────
  app.get(
    "/v1/admin/stats",
    {
      preHandler: requirePermission("dashboard", "read"),
      schema: {
        tags: ["admin"],
        summary: "Dashboard: users, items, feed health, top topics",
        response: {
          200: adminDashboardStatsResponseSchema,
        },
      },
    },
    adminController.getStats,
  );

  // ── Sources CRUD & Sync ───────────────────────────────────────────────────
  app.get(
    "/v1/admin/sources",
    {
      preHandler: requirePermission("sources", "read"),
      schema: {
        tags: ["admin"],
        summary: "List all sources with sync status",
        response: {
          200: sourcesListResponseSchema,
        },
      },
    },
    adminController.listSources,
  );

  app.post(
    "/v1/admin/sources",
    {
      preHandler: requirePermission("sources", "create"),
      schema: {
        tags: ["admin"],
        summary: "Create a new source",
        body: sourceCreateSchema,
        response: {
          201: z.object({ source: sourceSchema }),
        },
      },
    },
    adminController.createSource,
  );

  app.patch(
    "/v1/admin/sources/:id",
    {
      preHandler: requirePermission("sources", "update"),
      schema: {
        tags: ["admin"],
        summary: "Update a source",
        params: idParamSchema,
        body: sourcePatchSchema,
        response: {
          200: z.object({ source: sourceSchema }),
        },
      },
    },
    adminController.updateSource,
  );

  app.delete(
    "/v1/admin/sources/:id",
    {
      preHandler: requirePermission("sources", "write"),
      schema: {
        tags: ["admin"],
        summary: "Delete a source and its items",
        params: idParamSchema,
        response: {
          200: z.object({ deleted: z.literal(true) }),
        },
      },
    },
    adminController.deleteSource,
  );

  app.post(
    "/v1/admin/sources/:id/run",
    {
      preHandler: requirePermission("sources", "write"),
      schema: {
        tags: ["admin"],
        summary: "Trigger an immediate sync for one source",
        params: idParamSchema,
        response: {
          200: triggerSourceRunResponseSchema,
        },
      },
    },
    adminController.triggerSource,
  );

  app.get(
    "/v1/admin/sync-runs",
    {
      preHandler: requirePermission("sources", "read"),
      schema: {
        tags: ["admin"],
        summary: "Recent sync runs audit log",
        querystring: syncRunsQuerySchema,
        response: {
          200: syncRunsListResponseSchema,
        },
      },
    },
    adminController.listSyncRuns,
  );

  // ── Content Moderation ───────────────────────────────────────────────────
  app.get(
    "/v1/admin/items",
    {
      preHandler: requirePermission("content", "read"),
      schema: {
        tags: ["admin"],
        summary: "Browse and moderate content items",
        querystring: adminItemsQuerySchema,
        response: {
          200: adminItemsListResponseSchema,
        },
      },
    },
    adminController.listItems,
  );

  app.patch(
    "/v1/admin/items/:id",
    {
      preHandler: requirePermission("content", "update"),
      schema: {
        tags: ["admin"],
        summary: "Hide/unhide an item (moderation)",
        params: idParamSchema,
        body: itemPatchSchema,
        response: {
          200: z.object({ item: z.object({ id: z.string(), hidden: z.boolean() }) }),
        },
      },
    },
    adminController.patchItem,
  );

  app.post(
    "/v1/admin/items/:id/dismiss-reports",
    {
      preHandler: requirePermission("content", "write"),
      schema: {
        tags: ["admin"],
        summary: "Dismiss all reports on an item and unhide it",
        params: idParamSchema,
        response: {
          200: z.object({ item: z.object({ id: z.string(), hidden: z.boolean(), reportsCount: z.number() }) }),
        },
      },
    },
    adminController.dismissItemReports,
  );

  // ── Users Administration ─────────────────────────────────────────────────
  app.get(
    "/v1/admin/users",
    {
      preHandler: requirePermission("users", "read"),
      schema: {
        tags: ["admin"],
        summary: "List/search user accounts",
        querystring: adminUsersQuerySchema,
        response: {
          200: adminUsersListResponseSchema,
        },
      },
    },
    adminController.listUsers,
  );

  app.patch(
    "/v1/admin/users/:id",
    {
      preHandler: requirePermission("users", "update"),
      schema: {
        tags: ["admin"],
        summary: "Enable/disable an account and revoke active sessions",
        params: idParamSchema,
        body: userPatchSchema,
        response: {
          200: z.object({ user: z.object({ id: z.string(), disabledAt: z.union([z.date(), z.string()]).nullable() }) }),
        },
      },
    },
    adminController.patchUser,
  );

  // ── Topics CRUD ──────────────────────────────────────────────────────────
  app.get(
    "/v1/admin/topics",
    {
      preHandler: requirePermission("topics", "read"),
      schema: {
        tags: ["admin"],
        summary: "List all topics with item and follower metrics",
        response: {
          200: adminTopicsListResponseSchema,
        },
      },
    },
    adminController.listTopics,
  );

  app.post(
    "/v1/admin/topics",
    {
      preHandler: requirePermission("topics", "create"),
      schema: {
        tags: ["admin"],
        summary: "Create a topic",
        body: topicCreateSchema,
        response: {
          201: z.object({ topic: topicSchema }),
        },
      },
    },
    adminController.createTopic,
  );

  app.patch(
    "/v1/admin/topics/:id",
    {
      preHandler: requirePermission("topics", "update"),
      schema: {
        tags: ["admin"],
        summary: "Rename a topic / change icon",
        params: idParamSchema,
        body: topicPatchSchema,
        response: {
          200: z.object({ topic: topicSchema }),
        },
      },
    },
    adminController.patchTopic,
  );

  app.delete(
    "/v1/admin/topics/:id",
    {
      preHandler: requirePermission("topics", "write"),
      schema: {
        tags: ["admin"],
        summary: "Delete a topic (untags its items)",
        params: idParamSchema,
        response: {
          200: z.object({ deleted: z.literal(true) }),
        },
      },
    },
    adminController.deleteTopic,
  );

  // ── Tags CRUD ────────────────────────────────────────────────────────────
  app.get(
    "/v1/admin/tags",
    {
      preHandler: requirePermission("topics", "read"),
      schema: {
        tags: ["admin"],
        summary: "List all tags with topic and item metrics",
        response: {
          200: adminTagsResponseSchema,
        },
      },
    },
    adminController.listAdminTags,
  );

  app.post(
    "/v1/admin/tags",
    {
      preHandler: requirePermission("topics", "create"),
      schema: {
        tags: ["admin"],
        summary: "Create a tag",
        body: tagCreateSchema,
        response: {
          201: z.object({ tag: tagSchema }),
        },
      },
    },
    adminController.createTag,
  );

  app.patch(
    "/v1/admin/tags/:id",
    {
      preHandler: requirePermission("topics", "update"),
      schema: {
        tags: ["admin"],
        summary: "Update a tag",
        params: idParamSchema,
        body: tagPatchSchema,
        response: {
          200: z.object({ tag: tagSchema }),
        },
      },
    },
    adminController.updateTag,
  );

  app.delete(
    "/v1/admin/tags/:id",
    {
      preHandler: requirePermission("topics", "write"),
      schema: {
        tags: ["admin"],
        summary: "Delete a tag",
        params: idParamSchema,
        response: {
          200: z.object({ deleted: z.literal(true) }),
        },
      },
    },
    adminController.deleteTag,
  );

  // ── System Settings ──────────────────────────────────────────────────────
  app.get(
    "/v1/admin/settings",
    {
      preHandler: requirePermission("settings", "read"),
      schema: {
        tags: ["admin"],
        summary: "Get system algorithm and moderation settings",
        response: {
          200: systemSettingsResponseSchema,
        },
      },
    },
    adminController.getSettings,
  );

  app.patch(
    "/v1/admin/settings",
    {
      preHandler: requirePermission("settings", "update"),
      schema: {
        tags: ["admin"],
        summary: "Update system algorithm and moderation settings",
        body: patchSystemSettingsSchema,
        response: {
          200: systemSettingsResponseSchema,
        },
      },
    },
    adminController.updateSettings,
  );

  // ── Campaigns ────────────────────────────────────────────────────────────
  app.post(
    "/v1/admin/campaigns",
    {
      preHandler: requirePermission("campaigns", "create"),
      schema: {
        tags: ["admin"],
        summary: "Send an announcement push/email to a segment",
        body: campaignSchema,
        response: {
          202: campaignQueuedResponseSchema,
        },
      },
    },
    adminController.queueCampaign,
  );

  app.get(
    "/v1/admin/campaigns",
    {
      preHandler: requirePermission("campaigns", "read"),
      schema: {
        tags: ["admin"],
        summary: "Campaign delivery audit logs",
        querystring: campaignsQuerySchema,
        response: {
          200: campaignSendsResponseSchema,
        },
      },
    },
    adminController.listCampaigns,
  );

  // ── Cache Console ────────────────────────────────────────────────────────
  app.get(
    "/v1/admin/cache/overview",
    {
      preHandler: requirePermission("cache", "read"),
      schema: {
        tags: ["admin"],
        summary: "Redis cache status, memory usage, key counts, and ping latency",
        response: {
          200: cacheOverviewResponseSchema,
        },
      },
    },
    adminController.getCacheOverview,
  );

  app.get(
    "/v1/admin/cache/keys",
    {
      preHandler: requirePermission("cache", "read"),
      schema: {
        tags: ["admin"],
        summary: "List cached keys with namespace, TTL, and type",
        querystring: cacheKeysQuerySchema,
        response: {
          200: cacheKeysListResponseSchema,
        },
      },
    },
    adminController.listCacheKeys,
  );

  app.get(
    "/v1/admin/cache/keys/:key",
    {
      preHandler: requirePermission("cache", "read"),
      schema: {
        tags: ["admin"],
        summary: "Get single cache key details and inspect value",
        params: cacheKeyParamSchema,
        response: {
          200: cacheKeyDetailResponseSchema,
        },
      },
    },
    adminController.getCacheKeyDetail,
  );

  app.delete(
    "/v1/admin/cache/keys/:key",
    {
      preHandler: requirePermission("cache", "write"),
      schema: {
        tags: ["admin"],
        summary: "Delete a single cache key",
        params: cacheKeyParamSchema,
        response: {
          200: deleteCacheKeyResponseSchema,
        },
      },
    },
    adminController.deleteCacheKey,
  );

  app.post(
    "/v1/admin/cache/clear",
    {
      preHandler: requirePermission("cache", "write"),
      schema: {
        tags: ["admin"],
        summary: "Flush cached keys by namespace pattern (safe for queues)",
        body: clearCacheInputSchema,
        response: {
          200: clearCacheResponseSchema,
        },
      },
    },
    adminController.clearCacheNamespace,
  );
}
