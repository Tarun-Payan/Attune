import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  authResponseSchema,
  forgotPasswordSchema,
  loginSchema,
  oauthCallbackQuerySchema,
  oauthProviderParamSchema,
  oauthStartQuerySchema,
  okResponseSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from "@attune/schemas";
import { authController } from "../controller";
import { requireAuth } from "../plugins/auth-guard";

export async function authRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/v1/auth/register",
    {
      schema: {
        tags: ["auth"],
        summary: "Create an account (email + password)",
        body: registerSchema,
        response: {
          201: authResponseSchema,
        },
      },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    authController.register,
  );

  app.post(
    "/v1/auth/login",
    {
      schema: {
        tags: ["auth"],
        summary: "Login (email + password)",
        body: loginSchema,
        response: {
          200: authResponseSchema,
        },
      },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    authController.login,
  );

  app.post(
    "/v1/auth/forgot-password",
    {
      schema: {
        tags: ["auth"],
        summary: "Send password reset verification code",
        body: forgotPasswordSchema,
        response: {
          200: z.object({
            message: z.string(),
            expiresInSeconds: z.number(),
          }),
        },
      },
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    authController.forgotPassword,
  );

  app.post(
    "/v1/auth/reset-password",
    {
      schema: {
        tags: ["auth"],
        summary: "Reset password with verification code",
        body: resetPasswordSchema,
        response: {
          200: z.object({
            message: z.string(),
          }),
        },
      },
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    authController.resetPassword,
  );

  app.post(
    "/v1/auth/refresh",
    {
      schema: {
        tags: ["auth"],
        summary: "Rotate tokens (refresh token is single-use)",
        body: refreshSchema,
        response: {
          200: authResponseSchema,
        },
      },
    },
    authController.refresh,
  );

  app.post(
    "/v1/auth/logout",
    {
      schema: {
        tags: ["auth"],
        summary: "Revoke one refresh token",
        body: refreshSchema,
        response: {
          200: okResponseSchema,
        },
      },
    },
    authController.logout,
  );

  app.post(
    "/v1/auth/logout-all",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["auth"],
        summary: "Revoke every session for the current user",
        security: [{ bearerAuth: [] }],
        response: {
          200: okResponseSchema,
        },
      },
    },
    authController.logoutAll,
  );

  app.get(
    "/v1/auth/oauth/:provider/start",
    {
      schema: {
        tags: ["auth"],
        summary: "Begin Google/GitHub OAuth (redirects to provider)",
        params: oauthProviderParamSchema,
        querystring: oauthStartQuerySchema,
      },
    },
    authController.oauthStart,
  );

  app.get(
    "/v1/auth/oauth/:provider/callback",
    {
      schema: {
        tags: ["auth"],
        summary: "OAuth callback — link-or-create account, issue tokens",
        params: oauthProviderParamSchema,
        querystring: oauthCallbackQuerySchema,
      },
    },
    authController.oauthCallback,
  );
}
