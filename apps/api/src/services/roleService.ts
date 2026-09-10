import type { AdminAction, AdminFeature, AdminPermission, AdminRole } from "@attune/types";
import type { RoleCreateInput, RolePatchInput } from "@attune/schemas";
import {
  assignUserAdminRole,
  createRole as createRoleRepo,
  deleteRole as deleteRoleRepo,
  findRoleById,
  findRoleByName,
  findRoles,
  getUserAdminRoleWithPermissions,
  updateRole as updateRoleRepo,
} from "../repository/roleRepository";
import { findUserById } from "../repository/userRepository";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";

export async function listRoles(): Promise<AdminRole[]> {
  return findRoles();
}

export async function getRole(id: string): Promise<AdminRole> {
  const role = await findRoleById(id);
  if (!role) {
    throw new NotFoundError("Role not found");
  }
  return role;
}

export async function createRole(input: RoleCreateInput): Promise<AdminRole> {
  const existing = await findRoleByName(input.name);
  if (existing) {
    throw new ConflictError(`A role with the name "${input.name}" already exists`);
  }

  return createRoleRepo({
    name: input.name,
    description: input.description,
    permissions: input.permissions,
  });
}

export async function updateRole(id: string, input: RolePatchInput): Promise<AdminRole> {
  const existing = await findRoleById(id);
  if (!existing) {
    throw new NotFoundError("Role not found");
  }

  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await findRoleByName(input.name);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError(`A role with the name "${input.name}" already exists`);
    }
  }

  // Prevent modifying critical properties of the system Super Admin role
  if (existing.isSystem && input.name && input.name !== existing.name) {
    throw new ForbiddenError("The name of a system role cannot be changed");
  }

  const updated = await updateRoleRepo(id, input);
  if (!updated) {
    throw new NotFoundError("Role not found");
  }

  return updated;
}

export async function deleteRole(id: string): Promise<{ deleted: boolean }> {
  const existing = await findRoleById(id);
  if (!existing) {
    throw new NotFoundError("Role not found");
  }

  if (existing.isSystem) {
    throw new ForbiddenError("System roles cannot be deleted");
  }

  const deleted = await deleteRoleRepo(id);
  return { deleted };
}

export async function assignRoleToUser(userId: string, roleId: string | null) {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  if (roleId) {
    const role = await findRoleById(roleId);
    if (!role) {
      throw new NotFoundError("Assigned role not found");
    }
  }

  return assignUserAdminRole(userId, roleId);
}

export async function getAdminUserPermissions(userId: string) {
  return getUserAdminRoleWithPermissions(userId);
}

export function hasPermission(
  permissions: AdminPermission[],
  feature: AdminFeature,
  action: AdminAction,
): boolean {
  return permissions.some((p) => p.feature === feature && p.action === action);
}
