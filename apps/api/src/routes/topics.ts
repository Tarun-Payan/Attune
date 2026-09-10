import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { tagsResponseSchema, topicsListResponseSchema } from "@attune/schemas";
import { topicController } from "../controller";

export async function topicsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/v1/topics",
    {
      schema: {
        tags: ["content"],
        summary: "List all selectable topics",
        response: {
          200: topicsListResponseSchema,
        },
      },
    },
    topicController.listTopics,
  );

  app.get(
    "/v1/tags",
    {
      schema: {
        tags: ["content"],
        summary: "List tags, optionally filtered by topicId",
        querystring: z.object({ topicId: z.string().optional() }),
        response: {
          200: tagsResponseSchema,
        },
      },
    },
    topicController.listTags,
  );
}

