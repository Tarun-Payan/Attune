import type { FastifyReply, FastifyRequest } from "fastify";
import type { InteractionInput } from "@attune/schemas";
import * as itemService from "../services/itemService";

export async function getItem(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const result = await itemService.getItemDetail(id, req.user?.id);
  return reply.code(200).send({ item: result });
}

export async function recordInteraction(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const body = req.body as InteractionInput;
  const result = await itemService.recordInteraction(req.user!.id, id, body);
  return reply.code(200).send(result);
}
