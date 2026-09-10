import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  idParamSchema,
  interactionResponseSchema,
  interactionSchema,
  itemDetailResponseSchema,
} from "@attune/schemas";
import { itemController } from "../controller";
import { requireAuth } from "../plugins/auth-guard";

export async function itemsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/v1/items/:id",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["content"],
        summary: "Item detail (full content + topics + source)",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: {
          200: itemDetailResponseSchema,
        },
      },
    },
    itemController.getItem,
  );

  app.post(
    "/v1/items/:id/interactions",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["content"],
        summary: "Record an interaction (view/like/save/hide…)",
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        body: interactionSchema,
        response: {
          200: interactionResponseSchema,
        },
      },
    },
    itemController.recordInteraction,
  );
}
