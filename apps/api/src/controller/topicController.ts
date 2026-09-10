import type { FastifyReply, FastifyRequest } from "fastify";
import * as topicService from "../services/topicService";

export async function listTopics(req: FastifyRequest, reply: FastifyReply) {
  const result = await topicService.listTopics();
  return reply.code(200).send(result);
}

export async function listTags(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as { topicId?: string };
  const result = await topicService.listTags(query?.topicId);
  return reply.code(200).send(result);
}

