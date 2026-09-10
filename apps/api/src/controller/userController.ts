import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  ChangePasswordInput,
  DeviceRegistrationInput,
  NotificationSettingsInput,
  PatchMeInput,
  PreferencesInput,
  RequestEmailChangeInput,
  VerifyEmailChangeInput,
} from "@attune/schemas";
import { PRESET_AVATARS } from "@attune/types";
import * as userService from "../services/userService";

export async function getAvatars(req: FastifyRequest, reply: FastifyReply) {
  return reply.code(200).send({ avatars: PRESET_AVATARS });
}

export async function requestEmailChange(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as RequestEmailChangeInput;
  const result = await userService.requestEmailChange(req.user!.id, body);
  return reply.code(200).send(result);
}

export async function verifyEmailChange(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as VerifyEmailChangeInput;
  const result = await userService.verifyEmailChange(req.user!.id, body);
  return reply.code(200).send(result);
}

export async function changePassword(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as ChangePasswordInput;
  const result = await userService.changePassword(req.user!.id, body);
  return reply.code(200).send(result);
}

export async function getMe(req: FastifyRequest, reply: FastifyReply) {
  const result = await userService.getMyProfile(req.user!.id);
  return reply.code(200).send(result);
}

export async function patchMe(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as PatchMeInput;
  const result = await userService.updateProfile(req.user!.id, body);
  return reply.code(200).send(result);
}

export async function replacePreferences(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as PreferencesInput;
  const result = await userService.replacePreferences(req.user!.id, body);
  return reply.code(200).send(result);
}

export async function replaceTopics(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as {
    topicKeys?: string[];
    topics?: string[] | { key: string; notify?: boolean }[];
  };
  let items: { key: string; notify: boolean }[] = [];
  if (body.topicKeys) {
    items = body.topicKeys.map((k) => ({ key: k, notify: true }));
  } else if (Array.isArray(body.topics)) {
    items = body.topics.map((t) =>
      typeof t === "string" ? { key: t, notify: true } : { key: t.key, notify: t.notify ?? true },
    );
  }
  const result = await userService.replacePreferences(req.user!.id, { topics: items });
  return reply.code(200).send(result);
}


export async function getNotificationSettings(req: FastifyRequest, reply: FastifyReply) {
  const result = await userService.getNotificationSettings(req.user!.id);
  return reply.code(200).send(result);
}

export async function patchNotificationSettings(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as NotificationSettingsInput;
  const result = await userService.updateNotificationSettings(req.user!.id, body);
  return reply.code(200).send(result);
}

export async function registerDevice(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as DeviceRegistrationInput;
  const result = await userService.registerDevice(req.user!.id, body);
  return reply.code(201).send(result);
}

export async function removeDevice(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const result = await userService.removeDevice(req.user!.id, id);
  return reply.code(200).send(result);
}

export async function getSaved(req: FastifyRequest, reply: FastifyReply) {
  const result = await userService.getSavedItems(req.user!.id);
  return reply.code(200).send(result);
}

export async function getInAppNotifications(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as { limit?: number; offset?: number };
  const result = await userService.getInAppNotifications(
    req.user!.id,
    query.limit ? Number(query.limit) : 20,
    query.offset ? Number(query.offset) : 0,
  );
  return reply.code(200).send(result);
}

export async function markInAppNotificationRead(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const result = await userService.markInAppNotificationAsRead(req.user!.id, id);
  return reply.code(200).send(result);
}

export async function markAllInAppNotificationsRead(req: FastifyRequest, reply: FastifyReply) {
  const result = await userService.markAllInAppNotificationsAsRead(req.user!.id);
  return reply.code(200).send(result);
}
