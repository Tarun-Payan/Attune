import type { FastifyInstance } from "fastify";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { allQueues } from "../queues";
import { verifyAccessToken } from "../services/jwtService";
import { getUserAdminRoleWithPermissions } from "../repository/roleRepository";
import { UnauthorizedError } from "../errors";

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

/**
 * Bull Board plugin: live queue monitoring dashboard at /admin/queues.
 * Protected by Bearer token / Cookie with jobs:read permission check.
 */
export async function bullBoardPlugin(app: FastifyInstance) {
  const boardQueues = allQueues.map((q) => new BullMQAdapter(q));
  const serverAdapter = new FastifyAdapter();
  createBullBoard({ queues: boardQueues, serverAdapter });

  app.addHook("preHandler", async (req, reply) => {
    const rawUrl = req.url;
    if (!rawUrl.startsWith("/admin/queues")) return;

    // 1. Allow all static UI assets without token verification (CSS, JS, fonts, images)
    const urlPath = rawUrl.split("?")[0];
    if (
      urlPath.startsWith("/admin/queues/static/") ||
      /\.(css|js|svg|png|ico|woff2?|ttf|map)$/i.test(urlPath)
    ) {
      return;
    }

    // 2. Extract token from Query param, Authorization header, or Cookie
    const cookies = parseCookies(req.headers.cookie);
    const queryToken = (req.query as Record<string, string | undefined>)?.token;
    const authHeaderToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined;
    const cookieToken = cookies["bull_board_token"];

    const token = queryToken ?? authHeaderToken ?? cookieToken;

    if (token) {
      try {
        const payload = await verifyAccessToken(token);
        if (payload.typ === "access") {
          const roleInfo = await getUserAdminRoleWithPermissions(String(payload.sub));
          if (roleInfo?.permissions.some((p) => p.feature === "jobs" && p.action === "read")) {
            // Set session cookie for subsequent Bull Board sub-requests if token was explicitly provided in query
            if (queryToken) {
              reply.header(
                "Set-Cookie",
                `bull_board_token=${encodeURIComponent(queryToken)}; Path=/admin/queues; HttpOnly; SameSite=Lax`,
              );
            }
            return;
          }
        }
      } catch {
        // Fall through to domain error
      }
    }

    throw new UnauthorizedError("Unauthorized — requires valid admin token with jobs:read permission");
  });

  await app.register(serverAdapter.registerPlugin(), { prefix: "/admin/queues" });
}
