import type { FastifyReply, FastifyRequest } from "fastify";
import * as healthService from "../services/healthService";

export async function getHealth(_req: FastifyRequest, reply: FastifyReply) {
  const result = await healthService.getHealthStatus();
  return reply.code(200).send(result);
}
