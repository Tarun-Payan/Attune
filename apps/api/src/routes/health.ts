import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { healthResponseSchema } from "@attune/schemas";
import { healthController } from "../controller";

export async function healthRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        summary: "Liveness + database connectivity check",
        response: {
          200: healthResponseSchema,
        },
      },
    },
    healthController.getHealth,
  );
}
