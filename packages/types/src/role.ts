import type { AdminAction, AdminFeature } from "./enums";
import type { PublicUser } from "./user";

export interface AdminPermission {
  feature: AdminFeature;
  action: AdminAction;
}

export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: AdminPermission[];
  usersCount?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AdminRolesResponse {
  roles: AdminRole[];
}

export interface AdminRoleDetailResponse {
  role: AdminRole;
}

export interface AdminUserWithRole extends PublicUser {
  adminRoleId: string | null;
  adminRoleName?: string | null;
}

export interface AdminAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AdminUserWithRole;
  role: AdminRole;
  permissions: AdminPermission[];
}

export interface AdminMeResponse {
  user: AdminUserWithRole;
  role: AdminRole;
  permissions: AdminPermission[];
}
