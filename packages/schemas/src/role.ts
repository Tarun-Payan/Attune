import { z } from "zod";
import { ADMIN_ACTIONS, ADMIN_FEATURES } from "@attune/types";
import { publicUserSchema } from "./auth";

// ── Enums Schemas ──────────────────────────────────────────────────────────

export const adminFeatureSchema = z.enum(ADMIN_FEATURES);
export const adminActionSchema = z.enum(ADMIN_ACTIONS);

export const adminPermissionSchema = z.object({
  feature: adminFeatureSchema,
  action: adminActionSchema,
});

// ── Role Request Schemas ───────────────────────────────────────────────────

export const roleCreateSchema = z.object({
  name: z.string().trim().min(2, "Role name must be at least 2 characters").max(64, "Role name cannot exceed 64 characters"),
  description: z.string().trim().max(255, "Description cannot exceed 255 characters").optional(),
  permissions: z.array(adminPermissionSchema).default([]),
});

export const rolePatchSchema = z.object({
  name: z.string().trim().min(2, "Role name must be at least 2 characters").max(64, "Role name cannot exceed 64 characters").optional(),
  description: z.string().trim().max(255, "Description cannot exceed 255 characters").nullable().optional(),
  permissions: z.array(adminPermissionSchema).optional(),
});

export const userAssignRoleSchema = z.object({
  roleId: z.string().nullable(),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ── Role Response Schemas ──────────────────────────────────────────────────

export const adminRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  permissions: z.array(adminPermissionSchema),
  usersCount: z.number().optional(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const adminRolesResponseSchema = z.object({
  roles: z.array(adminRoleSchema),
});

export const adminRoleDetailResponseSchema = z.object({
  role: adminRoleSchema,
});

export const adminUserWithRoleSchema = publicUserSchema.extend({
  adminRoleId: z.string().nullable(),
  adminRoleName: z.string().nullable().optional(),
});

export const adminAuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  user: adminUserWithRoleSchema,
  role: adminRoleSchema,
  permissions: z.array(adminPermissionSchema),
});

export const adminMeResponseSchema = z.object({
  user: adminUserWithRoleSchema,
  role: adminRoleSchema,
  permissions: z.array(adminPermissionSchema),
});

// ── Inferred Types ─────────────────────────────────────────────────────────

export type RoleCreateInput = z.infer<typeof roleCreateSchema>;
export type RolePatchInput = z.infer<typeof rolePatchSchema>;
export type UserAssignRoleInput = z.infer<typeof userAssignRoleSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminRoleDTO = z.infer<typeof adminRoleSchema>;
export type AdminRolesResponseDTO = z.infer<typeof adminRolesResponseSchema>;
export type AdminRoleDetailResponseDTO = z.infer<typeof adminRoleDetailResponseSchema>;
export type AdminAuthResponseDTO = z.infer<typeof adminAuthResponseSchema>;
export type AdminMeResponseDTO = z.infer<typeof adminMeResponseSchema>;
