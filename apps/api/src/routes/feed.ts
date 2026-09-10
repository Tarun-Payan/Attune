import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { feedQuerySchema, feedResponseSchema } from "@attune/schemas";
import { feedController } from "../controller";
import { requireAuth } from "../plugins/auth-guard";

export async function feedRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/v1/feed",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["content"],
        summary: "Personalized feed (ranked, cursor-paginated)",
        security: [{ bearerAuth: [] }],
        querystring: feedQuerySchema,
        response: {
          200: feedResponseSchema,
        },
      },
    },
    feedController.getFeed,
  );
}
