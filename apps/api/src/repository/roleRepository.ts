import { and, eq, sql } from "drizzle-orm";
import { db } from "@attune/db/client";
import {
  adminRolePermissions,
  adminRoles,
  users,
} from "@attune/db/schema";
import {
  ADMIN_ACTIONS,
  ADMIN_FEATURES,
  type AdminAction,
  type AdminFeature,
  type AdminPermission,
  type AdminRole,
} from "@attune/types";
import { hashPassword } from "../services/jwtService";

export interface CreateRoleData {
  name: string;
  description?: string | null;
  permissions: AdminPermission[];
  isSystem?: boolean;
}

export interface UpdateRoleData {
  name?: string;
  description?: string | null;
  permissions?: AdminPermission[];
}

export async function findRoles(): Promise<AdminRole[]> {
  const roles = await db
    .select({
      id: adminRoles.id,
      name: adminRoles.name,
      description: adminRoles.description,
      isSystem: adminRoles.isSystem,
      createdAt: adminRoles.createdAt,
      updatedAt: adminRoles.updatedAt,
      usersCount: sql<number>`(SELECT count(*) FROM users u WHERE u.admin_role_id = ${adminRoles.id})`,
    })
    .from(adminRoles)
    .orderBy(adminRoles.createdAt);

  const permissions = await db.select().from(adminRolePermissions);

  const permissionsByRoleId = new Map<string, AdminPermission[]>();
  for (const p of permissions) {
    const list = permissionsByRoleId.get(p.roleId) ?? [];
    list.push({
      feature: p.feature as AdminFeature,
      action: p.action as AdminAction,
    });
    permissionsByRoleId.set(p.roleId, list);
  }

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissions: permissionsByRoleId.get(r.id) ?? [],
    usersCount: Number(r.usersCount ?? 0),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function findRoleById(id: string): Promise<AdminRole | undefined> {
  const [role] = await db
    .select({
      id: adminRoles.id,
      name: adminRoles.name,
      description: adminRoles.description,
      isSystem: adminRoles.isSystem,
      createdAt: adminRoles.createdAt,
      updatedAt: adminRoles.updatedAt,
      usersCount: sql<number>`(SELECT count(*) FROM users u WHERE u.admin_role_id = ${adminRoles.id})`,
    })
    .from(adminRoles)
    .where(eq(adminRoles.id, id));

  if (!role) return undefined;

  const permissions = await db
    .select({ feature: adminRolePermissions.feature, action: adminRolePermissions.action })
    .from(adminRolePermissions)
    .where(eq(adminRolePermissions.roleId, id));

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: permissions.map((p) => ({
      feature: p.feature as AdminFeature,
      action: p.action as AdminAction,
    })),
    usersCount: Number(role.usersCount ?? 0),
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

export async function findRoleByName(name: string): Promise<AdminRole | undefined> {
  const [role] = await db
    .select()
    .from(adminRoles)
    .where(eq(adminRoles.name, name));

  if (!role) return undefined;
  return findRoleById(role.id);
}

export async function createRole(data: CreateRoleData): Promise<AdminRole> {
  return await db.transaction(async (tx) => {
    const [role] = await tx
      .insert(adminRoles)
      .values({
        name: data.name.trim(),
        description: data.description?.trim() ?? null,
        isSystem: data.isSystem ?? false,
      })
      .returning();

    if (data.permissions.length > 0) {
      // Deduplicate permissions
      const uniquePerms = Array.from(
        new Map(data.permissions.map((p) => [`${p.feature}:${p.action}`, p])).values(),
      );

      await tx.insert(adminRolePermissions).values(
        uniquePerms.map((p) => ({
          roleId: role.id,
          feature: p.feature,
          action: p.action,
        })),
      );
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: data.permissions,
      usersCount: 0,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  });
}

export async function updateRole(id: string, data: UpdateRoleData): Promise<AdminRole | undefined> {
  return await db.transaction(async (tx) => {
    const updates: Partial<typeof adminRoles.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.description !== undefined) updates.description = data.description?.trim() ?? null;

    const [updated] = await tx
      .update(adminRoles)
      .set(updates)
      .where(eq(adminRoles.id, id))
      .returning();

    if (!updated) return undefined;

    if (data.permissions !== undefined) {
      await tx.delete(adminRolePermissions).where(eq(adminRolePermissions.roleId, id));

      const uniquePerms = Array.from(
        new Map(data.permissions.map((p) => [`${p.feature}:${p.action}`, p])).values(),
      );

      if (uniquePerms.length > 0) {
        await tx.insert(adminRolePermissions).values(
          uniquePerms.map((p) => ({
            roleId: id,
            feature: p.feature,
            action: p.action,
          })),
        );
      }
    }

    return findRoleById(id);
  });
}

export async function deleteRole(id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(adminRoles)
    .where(and(eq(adminRoles.id, id), eq(adminRoles.isSystem, false)))
    .returning();

  return Boolean(deleted);
}

export async function getUserAdminRoleWithPermissions(
  userId: string,
): Promise<{ role: AdminRole; permissions: AdminPermission[] } | null> {
  const [user] = await db
    .select({ adminRoleId: users.adminRoleId })
    .from(users)
    .where(eq(users.id, userId));

  if (!user || !user.adminRoleId) return null;

  const role = await findRoleById(user.adminRoleId);
  if (!role) return null;

  return {
    role,
    permissions: role.permissions,
  };
}

export async function assignUserAdminRole(userId: string, roleId: string | null) {
  const [updated] = await db
    .update(users)
    .set({ adminRoleId: roleId })
    .where(eq(users.id, userId))
    .returning({ id: users.id, adminRoleId: users.adminRoleId });

  return updated;
}

export async function seedSuperAdminRole() {
  const existing = await findRoleByName("Super Admin");
  let superAdminRole = existing;

  const allPermissions: AdminPermission[] = [];
  for (const feature of ADMIN_FEATURES) {
    for (const action of ADMIN_ACTIONS) {
      allPermissions.push({ feature, action });
    }
  }

  if (!existing) {
    superAdminRole = await createRole({
      name: "Super Admin",
      description: "Full access to all administrative features and operations",
      isSystem: true,
      permissions: allPermissions,
    });
  } else if (existing.permissions.length < allPermissions.length) {
    // Ensure Super Admin has any newly added features/actions
    await updateRole(existing.id, { permissions: allPermissions });
  }

  // Ensure default super admin user exists if configured or fallback
  const adminEmail = (process.env.SUPERADMIN_EMAIL ?? "admin@attune.local").toLowerCase().trim();
  const adminPassword = process.env.SUPERADMIN_PASSWORD ?? "admin123456";

  const existingAdminUser = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail));

  if (existingAdminUser.length === 0) {
    const passwordHash = await hashPassword(adminPassword);
    await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      name: "Super Admin",
      role: "ADMIN",
      adminRoleId: superAdminRole!.id,
    });
  } else if (!existingAdminUser[0].adminRoleId) {
    await assignUserAdminRole(existingAdminUser[0].id, superAdminRole!.id);
  }
}
