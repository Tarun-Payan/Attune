import type { FastifyReply, FastifyRequest } from "fastify";
import type { AdminLoginInput, RoleCreateInput, RolePatchInput, UserAssignRoleInput } from "@attune/schemas";
import * as roleService from "../services/roleService";
import * as authService from "../services/authService";

export async function login(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as AdminLoginInput;
  const result = await authService.adminLogin(body);
  return reply.code(200).send(result);
}

export async function getMe(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.user!.id;
  const result = await authService.getAdminMe(userId);
  return reply.code(200).send(result);
}

export async function listRoles(req: FastifyRequest, reply: FastifyReply) {
  const roles = await roleService.listRoles();
  return reply.code(200).send({ roles });
}

export async function getRole(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const role = await roleService.getRole(id);
  return reply.code(200).send({ role });
}

export async function createRole(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as RoleCreateInput;
  const role = await roleService.createRole(body);
  return reply.code(201).send({ role });
}

export async function updateRole(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const body = req.body as RolePatchInput;
  const role = await roleService.updateRole(id, body);
  return reply.code(200).send({ role });
}

export async function deleteRole(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const result = await roleService.deleteRole(id);
  return reply.code(200).send(result);
}

export async function assignUserRole(req: FastifyRequest, reply: FastifyReply) {
  const { id: userId } = req.params as { id: string };
  const { roleId } = req.body as UserAssignRoleInput;
  const result = await roleService.assignRoleToUser(userId, roleId);
  return reply.code(200).send({ user: result });
}
