import "./env";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { errorHandler } from "./middleware/errorHandler";
import { bullBoardPlugin } from "./plugins/bull-board";
import { healthRoutes } from "./routes/health";
import { topicsRoutes } from "./routes/topics";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { itemsRoutes } from "./routes/items";
import { feedRoutes } from "./routes/feed";
import { searchRoutes } from "./routes/search";
import { statsRoutes } from "./routes/stats";
import { seedSuperAdminRole } from "./repository/roleRepository";
import { getFastifyLoggerConfig, logRequestCompletion } from "@attune/logger";

import { closeAllQueues } from "./queues";
import { closeRedisClient, getRedisClient } from "@attune/cache";

const app = Fastify({
  ...getFastifyLoggerConfig("api", {
    redisClient: process.env.NODE_ENV !== "test" ? getRedisClient() : undefined,
  }),
});

// Always attach the correlation request ID to response headers
app.addHook("onSend", async (req, reply) => {
  reply.header("x-request-id", req.id);
});

// Single structured log on request completion (categorized by HTTP status code)
app.addHook("onResponse", async (req, reply) => {
  logRequestCompletion(req, reply);
});


// Set Zod validator and serializer compilers
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Tolerantly handle empty JSON bodies instead of throwing FST_ERR_CTP_EMPTY_JSON_BODY
app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
  if (typeof body === "string" && body.trim() === "") {
    done(null, undefined);
    return;
  }
  try {
    const json = JSON.parse(body as string);
    done(null, json);
  } catch (err) {
    done(err as Error, undefined);
  }
});

// Fail-loud configuration checks: fine to run without these locally, never in production
if (!process.env.JWT_SECRET) {
  app.log.warn("JWT_SECRET is not set — falling back to an INSECURE development secret. Never do this in production.");
}

// Centralized error handler: logs with request context, never leaks stack traces
app.setErrorHandler(errorHandler);

// CORS: comma-separated allowlist in production (CORS_ORIGINS), permissive in dev
const corsOrigins = process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
await app.register(cors, corsOrigins ? { origin: corsOrigins } : { origin: true });
await app.register(rateLimit, {
  global: true,
  max: 300,
  timeWindow: "1 minute",
});

// Swagger OpenAPI 3.0 Documentation with typed Zod transform
await app.register(swagger, {
  openapi: {
    info: {
      title: "Attune API",
      version: "0.3.0",
      description: "Personalized news & technology-update aggregator — typed backend API",
    },
    servers: [{ url: process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? process.env.API_PORT ?? 3000}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  transform: jsonSchemaTransform,
});
await app.register(swaggerUi, { routePrefix: "/docs" });

// ── Static Asset Serving (/public/* and /avatars/*) ──────────────────────────
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
await app.register(fastifyStatic, {
  root: publicDir,
  prefix: "/public/",
});
await app.register(fastifyStatic, {
  root: path.join(publicDir, "avatars"),
  prefix: "/avatars/",
  decorateReply: false,
});

await app.register(healthRoutes);
await app.register(topicsRoutes);
await app.register(adminRoutes);
await app.register(authRoutes);
await app.register(meRoutes);
await app.register(itemsRoutes);
await app.register(feedRoutes);
await app.register(searchRoutes);
await app.register(statsRoutes);

await app.register(bullBoardPlugin);

// Ensure Super Admin role & default super admin account exist
await seedSuperAdminRole().catch((err) => {
  app.log.warn({ err }, "Super Admin role bootstrap check failed");
});

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
app.log.info(`Attune API listening on :${port} — docs at http://localhost:${port}/docs`);

// Graceful shutdown
async function shutdown() {
  app.log.info("Shutting down API server...");
  await app.close();
  await closeAllQueues();
  await closeRedisClient();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

