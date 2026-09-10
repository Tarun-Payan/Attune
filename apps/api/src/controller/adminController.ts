import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  CampaignInput,
  ItemPatchInput,
  PatchSystemSettingsInput,
  SourceCreateInput,
  SourcePatchInput,
  TagCreateInput,
  TagPatchInput,
  AdminItemsQueryInput,
  TopicCreateInput,
  TopicPatchInput,
  UserPatchInput,
} from "@attune/schemas";
import type { SyncStatus } from "@attune/types";
import * as adminService from "../services/adminService";

export async function getStats(req: FastifyRequest, reply: FastifyReply) {
  const result = await adminService.getDashboardStats();
  return reply.code(200).send(result);
}

export async function listSources(req: FastifyRequest, reply: FastifyReply) {
  const result = await adminService.listSources();
  return reply.code(200).send(result);
}

export async function createSource(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as SourceCreateInput;
  const result = await adminService.createSource(body);
  return reply.code(201).send(result);
}

export async function updateSource(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const body = req.body as SourcePatchInput;
  const result = await adminService.updateSource(id, body);
  return reply.code(200).send(result);
}

export async function deleteSource(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const result = await adminService.deleteSource(id);
  return reply.code(200).send(result);
}

export async function triggerSource(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const result = await adminService.triggerSourceSync(id);
  return reply.code(200).send(result);
}

export async function listSyncRuns(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as { sourceId?: string; limit?: number; offset?: number; status?: SyncStatus };
  const limit = Math.min(Math.max(Number(query?.limit ?? 20), 1), 100);
  const offset = Math.max(Number(query?.offset ?? 0), 0);
  const result = await adminService.listSyncRuns(query?.sourceId, limit, offset, query?.status);
  return reply.code(200).send(result);
}

export async function listItems(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as AdminItemsQueryInput;
  const result = await adminService.listItems(query);
  return reply.code(200).send(result);
}

export async function patchItem(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const body = req.body as ItemPatchInput;
  const result = await adminService.setItemHidden(id, body.hidden);
  return reply.code(200).send(result);
}

export async function dismissItemReports(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const result = await adminService.dismissItemReports(id);
  return reply.code(200).send(result);
}

export async function listUsers(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as { q?: string; limit?: number; offset?: number };
  const limit = Math.min(Math.max(Number(query?.limit ?? 25), 1), 100);
  const offset = Math.max(Number(query?.offset ?? 0), 0);
  const result = await adminService.listUsers({ q: query?.q, limit, offset });
  return reply.code(200).send(result);
}

export async function patchUser(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const body = req.body as UserPatchInput;
  const result = await adminService.setUserDisabled(id, body.disabled);
  return reply.code(200).send(result);
}

export async function listTopics(req: FastifyRequest, reply: FastifyReply) {
  const result = await adminService.listTopics();
  return reply.code(200).send(result);
}

export async function createTopic(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as TopicCreateInput;
  const result = await adminService.createTopic(body);
  return reply.code(201).send(result);
}

export async function patchTopic(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const body = req.body as TopicPatchInput;
  const result = await adminService.updateTopic(id, body);
  return reply.code(200).send(result);
}

export async function deleteTopic(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const result = await adminService.deleteTopic(id);
  return reply.code(200).send(result);
}

export async function listTags(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as { topicId?: string };
  const result = await adminService.listTags(query?.topicId);
  return reply.code(200).send(result);
}

export async function listAdminTags(req: FastifyRequest, reply: FastifyReply) {
  const result = await adminService.listAdminTags();
  return reply.code(200).send(result);
}

export async function createTag(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as TagCreateInput;
  const result = await adminService.createTag(body);
  return reply.code(201).send(result);
}

export async function updateTag(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const body = req.body as TagPatchInput;
  const result = await adminService.updateTag(id, body);
  return reply.code(200).send(result);
}

export async function deleteTag(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const result = await adminService.deleteTag(id);
  return reply.code(200).send(result);
}

export async function getSettings(req: FastifyRequest, reply: FastifyReply) {
  const result = await adminService.getSettings();
  return reply.code(200).send(result);
}

export async function updateSettings(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as PatchSystemSettingsInput;
  const result = await adminService.updateSettings(body);
  return reply.code(200).send(result);
}

export async function queueCampaign(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as CampaignInput;
  const result = await adminService.queueCampaign(body);
  return reply.code(202).send(result);
}

export async function listCampaigns(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as { limit?: number; offset?: number };
  const limit = Math.min(Math.max(Number(query?.limit ?? 25), 1), 100);
  const offset = Math.max(Number(query?.offset ?? 0), 0);
  const result = await adminService.listCampaigns(limit, offset);
  return reply.code(200).send(result);
}

export async function getCacheOverview(_req: FastifyRequest, reply: FastifyReply) {
  const result = await adminService.getCacheOverview();
  return reply.code(200).send(result);
}

export async function listCacheKeys(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as { prefix?: string; limit?: number };
  const result = await adminService.listCacheKeys(query?.prefix, query?.limit);
  return reply.code(200).send(result);
}

export async function getCacheKeyDetail(req: FastifyRequest, reply: FastifyReply) {
  const { key } = req.params as { key: string };
  const decodedKey = decodeURIComponent(key);
  const result = await adminService.getCacheKeyDetail(decodedKey);
  return reply.code(200).send(result);
}

export async function deleteCacheKey(req: FastifyRequest, reply: FastifyReply) {
  const { key } = req.params as { key: string };
  const decodedKey = decodeURIComponent(key);
  const result = await adminService.deleteCacheKey(decodedKey);
  return reply.code(200).send(result);
}

export async function clearCacheNamespace(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as { namespace: string; pattern?: string };
  const result = await adminService.clearCacheNamespace(body.namespace, body.pattern);
  return reply.code(200).send(result);
}
