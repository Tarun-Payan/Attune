import type { FastifyReply, FastifyRequest } from "fastify";
import type { FeedQueryInput, SearchQueryInput } from "@attune/schemas";
import * as feedService from "../services/feedService";

export async function getFeed(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as FeedQueryInput;
  const result = await feedService.getPersonalizedFeed(req.user!.id, query);
  return reply.code(200).send(result);
}

export async function search(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as SearchQueryInput;
  const result = await feedService.search(query);
  return reply.code(200).send(result);
}
