import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { readingStatsResponseSchema } from "@attune/schemas";
import { statsController } from "../controller";
import { requireAuth } from "../plugins/auth-guard";

export async function statsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/v1/me/stats",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["me"],
        summary: "My reading stats (streak, minutes, topics)",
        security: [{ bearerAuth: [] }],
        response: {
          200: readingStatsResponseSchema,
        },
      },
    },
    statsController.getMyStats,
  );
}
