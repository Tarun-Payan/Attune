import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  avatarsResponseSchema,
  changePasswordSchema,
  deviceRegistrationResponseSchema,
  deviceRegistrationSchema,
  idParamSchema,
  inAppNotificationsQuerySchema,
  inAppNotificationsResponseSchema,
  markAllNotificationsReadResponseSchema,
  markNotificationReadResponseSchema,
  meResponseSchema,
  notificationSettingsResponseSchema,
  notificationSettingsSchema,
  patchMeSchema,
  preferencesSchema,
  publicUserSchema,
  requestEmailChangeSchema,
  savedItemsResponseSchema,
  userPreferenceSchema,
  verifyEmailChangeSchema,
} from "@attune/schemas";
import { userController } from "../controller";
import { requireAuth } from "../plugins/auth-guard";

export async function meRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/v1/me",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "My profile + preferences",
        security: [{ bearerAuth: [] }],
        response: {
          200: meResponseSchema,
        },
      },
    },
    userController.getMe,
  );

  app.patch(
    "/v1/me",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Update my profile",
        security: [{ bearerAuth: [] }],
        body: patchMeSchema,
        response: {
          200: z.object({ user: publicUserSchema }),
        },
      },
    },
    userController.patchMe,
  );

  app.get(
    "/v1/me/avatars",
    {
      schema: {
        tags: ["me"],
        summary: "Get predefined preset avatars",
        response: {
          200: avatarsResponseSchema,
        },
      },
    },
    userController.getAvatars,
  );

  app.post(
    "/v1/me/email/request",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Request verification code to change email address",
        security: [{ bearerAuth: [] }],
        body: requestEmailChangeSchema,
        response: {
          200: z.object({
            message: z.string(),
            expiresInSeconds: z.number(),
          }),
        },
      },
    },
    userController.requestEmailChange,
  );

  app.post(
    "/v1/me/email/verify",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Verify code and update email address",
        security: [{ bearerAuth: [] }],
        body: verifyEmailChangeSchema,
        response: {
          200: z.object({
            user: publicUserSchema,
            message: z.string(),
          }),
        },
      },
    },
    userController.verifyEmailChange,
  );

  app.post(
    "/v1/me/password",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Change account password",
        security: [{ bearerAuth: [] }],
        body: changePasswordSchema,
        response: {
          200: z.object({
            message: z.string(),
          }),
        },
      },
    },
    userController.changePassword,
  );

  app.put(
    "/v1/me/preferences",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Replace my topic preferences (+ per-topic push flag)",
        security: [{ bearerAuth: [] }],
        body: preferencesSchema,
        response: {
          200: z.object({ preferences: z.array(userPreferenceSchema) }),
        },
      },
    },
    userController.replacePreferences,
  );

  app.put(
    "/v1/me/topics",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Replace my topics by key list",
        security: [{ bearerAuth: [] }],
        body: z.object({
          topicKeys: z.array(z.string()).optional(),
          topics: z.union([
            z.array(z.string()),
            z.array(z.object({ key: z.string(), notify: z.boolean().optional() })),
          ]).optional(),
        }),
        response: {
          200: z.object({ preferences: z.array(userPreferenceSchema) }),
        },
      },
    },
    userController.replaceTopics,
  );


  app.get(
    "/v1/me/notification-settings",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "My notification settings",
        security: [{ bearerAuth: [] }],
        response: {
          200: notificationSettingsResponseSchema,
        },
      },
    },
    userController.getNotificationSettings,
  );

  app.patch(
    "/v1/me/notification-settings",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Update notification settings",
        security: [{ bearerAuth: [] }],
        body: notificationSettingsSchema,
        response: {
          200: notificationSettingsResponseSchema,
        },
      },
    },
    userController.patchNotificationSettings,
  );

  app.post(
    "/v1/me/devices",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Register a push token (Expo Go or FCM)",
        security: [{ bearerAuth: [] }],
        body: deviceRegistrationSchema,
        response: {
          201: deviceRegistrationResponseSchema,
        },
      },
    },
    userController.registerDevice,
  );

  app.delete(
    "/v1/me/devices/:id",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Remove a registered device",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: {
          200: z.object({ removed: z.literal(true) }),
        },
      },
    },
    userController.removeDevice,
  );

  app.get(
    "/v1/me/saved",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "My saved (bookmarked) items",
        security: [{ bearerAuth: [] }],
        response: {
          200: savedItemsResponseSchema,
        },
      },
    },
    userController.getSaved,
  );

  // ── In-App Notifications ──────────────────────────────────────────────────
  app.get(
    "/v1/me/notifications",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Get my in-app notifications with unread count",
        security: [{ bearerAuth: [] }],
        querystring: inAppNotificationsQuerySchema,
        response: {
          200: inAppNotificationsResponseSchema,
        },
      },
    },
    userController.getInAppNotifications,
  );

  app.patch(
    "/v1/me/notifications/:id/read",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Mark a notification as read",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: {
          200: markNotificationReadResponseSchema,
        },
      },
    },
    userController.markInAppNotificationRead,
  );

  app.post(
    "/v1/me/notifications/read-all",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "Mark all notifications as read",
        security: [{ bearerAuth: [] }],
        response: {
          200: markAllNotificationsReadResponseSchema,
        },
      },
    },
    userController.markAllInAppNotificationsRead,
  );
}
