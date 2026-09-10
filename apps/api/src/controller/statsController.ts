import type { FastifyReply, FastifyRequest } from "fastify";
import * as statsService from "../services/statsService";

export async function getMyStats(req: FastifyRequest, reply: FastifyReply) {
  const stats = await statsService.getUserReadingStats(req.user!.id);
  return reply.code(200).send(stats);
}
