import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { feedResponseSchema, searchQuerySchema } from "@attune/schemas";
import { feedController } from "../controller";
import { requireAuth } from "../plugins/auth-guard";

export async function searchRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/v1/search",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["content"],
        summary: "Search items (Postgres full-text)",
        security: [{ bearerAuth: [] }],
        querystring: searchQuerySchema,
        response: {
          200: feedResponseSchema.omit({ nextCursor: true }),
        },
      },
    },
    feedController.search,
  );
}
