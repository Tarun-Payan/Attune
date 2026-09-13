import type { FastifyRequest } from "fastify";
import type { AdminAction, AdminFeature, AdminPermission, UserRole } from "@attune/types";
import { verifyAccessToken } from "../services/jwtService";
import { getUserAdminRoleWithPermissions } from "../repository/roleRepository";
import { ForbiddenError, UnauthorizedError } from "../errors";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      role: UserRole;
      adminRoleId?: string | null;
      adminRoleName?: string | null;
      permissions?: AdminPermission[];
    };
  }
}

/** preHandler: requires a valid Bearer access token. */
export async function requireAuth(req: FastifyRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing bearer token");
  }

  try {
    const payload = await verifyAccessToken(header.slice(7));
    if (payload.typ !== "access") {
      throw new Error("wrong token type");
    }
    req.user = {
      id: String(payload.sub),
      role: (payload.role as UserRole) ?? "USER",
    };
    req.log = req.log.child({ userId: req.user.id });
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

/** preHandler: requires a valid Bearer token for a user with an assigned admin role. */
export async function requireAdmin(req: FastifyRequest) {
  if (req.url.includes("/admin/auth/login")) {
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing bearer token");
  }

  let userId: string;
  let userRole: UserRole = "USER";

  try {
    const payload = await verifyAccessToken(header.slice(7));
    if (payload.typ !== "access") {
      throw new Error("wrong token type");
    }
    userId = String(payload.sub);
    userRole = (payload.role as UserRole) ?? "USER";
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }

  const roleInfo = await getUserAdminRoleWithPermissions(userId);
  if (!roleInfo) {
    throw new ForbiddenError("Access denied: You do not have an active admin role assigned");
  }

  req.user = {
    id: userId,
    role: userRole,
    adminRoleId: roleInfo.role.id,
    adminRoleName: roleInfo.role.name,
    permissions: roleInfo.permissions,
  };
  req.log = req.log.child({ userId: req.user.id });
}

/** preHandler factory: requires a specific admin permission (feature + action). */
export function requirePermission(feature: AdminFeature, action: AdminAction) {
  return async function (req: FastifyRequest) {
    if (!req.user?.permissions) {
      await requireAdmin(req);
    }

    const perms = req.user?.permissions ?? [];
    const allowed = perms.some((p) => p.feature === feature && p.action === action);

    if (!allowed) {
      throw new ForbiddenError(`Permission denied: requires ${feature}:${action}`);
    }
  };
}
