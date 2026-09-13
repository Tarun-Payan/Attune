import type { FastifyReply, FastifyRequest } from "fastify";
import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from "@attune/schemas";
import * as authService from "../services/authService";

export async function register(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as RegisterInput;
  const result = await authService.register(body, { requestId: req.id });
  return reply.code(201).send(result);
}

export async function login(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as LoginInput;
  const result = await authService.login(body);
  return reply.code(200).send(result);
}

export async function refresh(req: FastifyRequest, reply: FastifyReply) {
  const { refreshToken } = req.body as { refreshToken: string };
  const result = await authService.refresh(refreshToken);
  return reply.code(200).send(result);
}

export async function logout(req: FastifyRequest, reply: FastifyReply) {
  const { refreshToken } = req.body as { refreshToken: string };
  const result = await authService.logout(refreshToken);
  return reply.code(200).send(result);
}

export async function logoutAll(req: FastifyRequest, reply: FastifyReply) {
  const result = await authService.logoutAll(req.user!.id);
  return reply.code(200).send(result);
}

export async function oauthStart(req: FastifyRequest, reply: FastifyReply) {
  const { provider } = req.params as { provider: string };
  const { redirect } = (req.query as { redirect?: string }) ?? {};
  const { redirectUrl } = await authService.startOAuth(provider, redirect);
  return reply.redirect(redirectUrl);
}

export async function oauthCallback(req: FastifyRequest, reply: FastifyReply) {
  const { provider } = req.params as { provider: string };
  const { code, state } = req.query as { code: string; state: string };
  const { user, tokens, redirect } = await authService.handleOAuthCallback(
    provider,
    code,
    state,
    { requestId: req.id },
  );

  if (redirect) {
    const u = new URL(redirect);
    const params = new URLSearchParams({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
    u.hash = params.toString();
    u.searchParams.set("access_token", tokens.accessToken);
    u.searchParams.set("refresh_token", tokens.refreshToken);
    return reply.redirect(u.toString());
  }

  return reply.code(200).send({ user, ...tokens });
}

export async function forgotPassword(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as ForgotPasswordInput;
  const result = await authService.forgotPassword(body);
  return reply.code(200).send(result);
}

export async function resetPassword(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as ResetPasswordInput;
  const result = await authService.resetPassword(body);
  return reply.code(200).send(result);
}
