import { createRemoteJWKSet, jwtVerify } from "jose";
import { OAUTH_PROVIDERS, type AdminAuthResponse, type AdminMeResponse, type AuthResponse, type JobContext, type OAuthProfile, type OAuthProvider, type PublicUser, type User } from "@attune/types";
import type { AdminLoginInput, ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from "@attune/schemas";
import { notify } from "@attune/notifications";
import { enqueueWelcomeEmail } from "../queues";
import {
  createAccount,
  createUser,
  findAccountByProvider,
  findRefreshTokenByHash,
  findUserByEmail,
  findUserById,
  revokeAllUserTokens,
  revokeRefreshToken,
  updateUserPassword,
} from "../repository/userRepository";
import { getUserAdminRoleWithPermissions } from "../repository/roleRepository";
import {
  createVerificationCode,
  deleteVerificationCode,
  findValidVerificationCode,
} from "../repository/verificationRepository";
import {
  hashPassword,
  issueTokenPair,
  sha256Hex,
  signOAuthState,
  verifyOAuthState,
  verifyPassword,
} from "./jwtService";
import { sendPasswordResetCode } from "../lib/mailer";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
} from "../errors";

export function publicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    timezone: u.timezone,
    role: u.role,
    createdAt: u.createdAt,
  };
}

export function oauthConfig(provider: OAuthProvider): { clientId: string; clientSecret: string } | null {
  const id = provider === "GOOGLE" ? process.env.GOOGLE_CLIENT_ID : process.env.GITHUB_CLIENT_ID;
  const sec =
    provider === "GOOGLE" ? process.env.GOOGLE_CLIENT_SECRET : process.env.GITHUB_CLIENT_SECRET;
  return id && sec ? { clientId: id, clientSecret: sec } : null;
}

export function redirectUri(provider: OAuthProvider): string {
  const base = process.env.OAUTH_REDIRECT_BASE ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/v1/auth/oauth/${provider.toLowerCase()}/callback`;
}

export function allowedRedirect(candidate?: string): string | undefined {
  if (!candidate) return undefined;
  const base = process.env.OAUTH_REDIRECT_BASE ?? "http://localhost:3000";
  if (candidate.startsWith(base) || candidate.startsWith("attune://") || candidate.startsWith("exp://")) {
    return candidate;
  }
  return undefined;
}

export async function register(input: RegisterInput, context?: JobContext): Promise<AuthResponse> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await createUser({
    email: input.email,
    passwordHash,
    name: input.name,
  });

  await enqueueWelcomeEmail({
    userId: user.id,
    email: user.email,
    name: user.name ?? undefined,
    context,
  }).catch(() => {});

  await notify.welcome(user.id, user.name ?? undefined).catch(() => {});

  const tokens = await issueTokenPair(user);
  return {
    user: publicUser(user),
    ...tokens,
  };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await findUserByEmail(input.email);
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.disabledAt) {
    throw new ForbiddenError("This account has been disabled");
  }

  const tokens = await issueTokenPair(user);
  return {
    user: publicUser(user),
    ...tokens,
  };
}

export async function adminLogin(input: AdminLoginInput): Promise<AdminAuthResponse> {
  const user = await findUserByEmail(input.email);
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.disabledAt) {
    throw new ForbiddenError("This account has been disabled");
  }

  if (!user.adminRoleId) {
    throw new ForbiddenError("Access denied: Your account does not have an admin role assigned");
  }

  const roleInfo = await getUserAdminRoleWithPermissions(user.id);
  if (!roleInfo) {
    throw new ForbiddenError("Access denied: Assigned admin role does not exist");
  }

  const tokens = await issueTokenPair(user);
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    user: {
      ...publicUser(user),
      adminRoleId: user.adminRoleId,
      adminRoleName: roleInfo.role.name,
    },
    role: roleInfo.role,
    permissions: roleInfo.permissions,
  };
}

export async function getAdminMe(userId: string): Promise<AdminMeResponse> {
  const user = await findUserById(userId);
  if (!user || user.disabledAt) {
    throw new UnauthorizedError("User not found or disabled");
  }

  if (!user.adminRoleId) {
    throw new ForbiddenError("Access denied: Your account does not have an admin role assigned");
  }

  const roleInfo = await getUserAdminRoleWithPermissions(user.id);
  if (!roleInfo) {
    throw new ForbiddenError("Access denied: Assigned admin role does not exist");
  }

  return {
    user: {
      ...publicUser(user),
      adminRoleId: user.adminRoleId,
      adminRoleName: roleInfo.role.name,
    },
    role: roleInfo.role,
    permissions: roleInfo.permissions,
  };
}

export async function rotateRefreshToken(
  token: string,
): Promise<{ ok: true; user: User } | { ok: false; reason: "invalid" | "expired" | "reuse" }> {
  const tokenHash = sha256Hex(token);
  const row = await findRefreshTokenByHash(tokenHash);

  if (!row) return { ok: false, reason: "invalid" };

  if (row.revokedAt) {
    await revokeAllUserTokens(row.userId);
    return { ok: false, reason: "reuse" };
  }
  if (new Date(row.expiresAt).getTime() < Date.now()) return { ok: false, reason: "expired" };

  await revokeRefreshToken(tokenHash);

  const user = await findUserById(row.userId);
  if (!user) return { ok: false, reason: "invalid" };
  if (user.disabledAt) {
    await revokeAllUserTokens(user.id);
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, user };
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  const tokenHash = sha256Hex(refreshToken);
  const tokenRow = await findRefreshTokenByHash(tokenHash);

  if (!tokenRow) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  if (tokenRow.revokedAt) {
    // Reuse detected -> security compromise, revoke all sessions
    await revokeAllUserTokens(tokenRow.userId);
    throw new UnauthorizedError("Refresh token reuse detected — all sessions revoked");
  }

  if (new Date(tokenRow.expiresAt).getTime() < Date.now()) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  // Revoke the old token (single-use rotation)
  await revokeRefreshToken(tokenHash);

  const user = await findUserById(tokenRow.userId);
  if (!user || user.disabledAt) {
    if (user?.disabledAt) await revokeAllUserTokens(user.id);
    throw new UnauthorizedError("Invalid or disabled user account");
  }

  const tokens = await issueTokenPair(user);
  return {
    user: publicUser(user),
    ...tokens,
  };
}

export async function logout(refreshToken: string): Promise<{ ok: true }> {
  await revokeRefreshToken(sha256Hex(refreshToken));
  return { ok: true };
}

export async function logoutAll(userId: string): Promise<{ ok: true }> {
  await revokeAllUserTokens(userId);
  return { ok: true };
}

export async function startOAuth(rawProvider: string, redirect?: string) {
  const provider = rawProvider.toUpperCase() as OAuthProvider;
  if (!(OAUTH_PROVIDERS as readonly string[]).includes(provider)) {
    throw new NotFoundError("Unknown OAuth provider");
  }

  const cfg = oauthConfig(provider);
  if (!cfg) {
    throw new ServiceUnavailableError(`${provider} OAuth is not configured`, {
      hint: `Set ${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET in .env`,
    });
  }

  const safeRedirect = allowedRedirect(redirect);
  const state = await signOAuthState({ p: provider.toLowerCase(), r: safeRedirect });

  const url =
    provider === "GOOGLE"
      ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
      : new URL("https://github.com/login/oauth/authorize");

  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri(provider));
  url.searchParams.set("state", state);

  if (provider === "GOOGLE") {
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("prompt", "select_account");
  } else {
    url.searchParams.set("scope", "read:user user:email");
  }

  return { redirectUrl: url.toString() };
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

async function fetchGoogleProfile(
  code: string,
  cfg: { clientId: string; clientSecret: string },
  redirect: string,
): Promise<OAuthProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!tokenRes.ok) throw new BadRequestError(`Google token exchange failed: HTTP ${tokenRes.status}`);
  const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
  if (!idToken) throw new BadRequestError("Google response missing id_token");

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: cfg.clientId,
  });

  return {
    providerAccountId: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : undefined,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : undefined,
    avatarUrl: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

async function fetchGitHubProfile(
  code: string,
  cfg: { clientId: string; clientSecret: string },
  redirect: string,
): Promise<OAuthProfile> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirect,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!tokenRes.ok) throw new BadRequestError(`GitHub token exchange failed: HTTP ${tokenRes.status}`);
  const { access_token: ghToken } = (await tokenRes.json()) as { access_token?: string };
  if (!ghToken) throw new BadRequestError("GitHub did not return an access token");

  const headers = {
    Authorization: `Bearer ${ghToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "attune/0.1",
  };
  const userRes = await fetch("https://api.github.com/user", { headers, signal: AbortSignal.timeout(15_000) });
  if (!userRes.ok) throw new BadRequestError(`GitHub /user failed: HTTP ${userRes.status}`);
  const ghUser = (await userRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
    email: string | null;
  };

  let email = ghUser.email?.toLowerCase() ?? undefined;
  let emailVerified = false;
  const emailsRes = await fetch("https://api.github.com/user/emails", {
    headers,
    signal: AbortSignal.timeout(15_000),
  });

  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as { email: string; primary: boolean; verified: boolean }[];
    const primaryVerified = emails.find((e) => e.primary && e.verified);
    if (primaryVerified) {
      email = primaryVerified.email.toLowerCase();
      emailVerified = true;
    }
  }

  return {
    providerAccountId: String(ghUser.id),
    email,
    emailVerified,
    name: ghUser.name ?? ghUser.login,
    avatarUrl: ghUser.avatar_url,
  };
}

export async function handleOAuthCallback(rawProvider: string, code: string, state: string, context?: JobContext) {
  const provider = rawProvider.toUpperCase() as OAuthProvider;
  if (!(OAUTH_PROVIDERS as readonly string[]).includes(provider)) {
    throw new NotFoundError("Unknown OAuth provider");
  }

  const cfg = oauthConfig(provider);
  if (!cfg) throw new ServiceUnavailableError(`${provider} OAuth is not configured`);

  let redirect: string | undefined;
  try {
    const payload = await verifyOAuthState(state);
    if (payload.typ !== "oauth_state" || payload.p !== provider.toLowerCase()) {
      throw new Error("bad state");
    }
    redirect = allowedRedirect(payload.r as string | undefined);
  } catch {
    throw new BadRequestError("Invalid or expired OAuth state");
  }

  const profile =
    provider === "GOOGLE"
      ? await fetchGoogleProfile(code, cfg, redirectUri(provider))
      : await fetchGitHubProfile(code, cfg, redirectUri(provider));

  let user: User | undefined;

  // 1) Check already linked account
  const linkedAccount = await findAccountByProvider(provider, profile.providerAccountId);
  if (linkedAccount) {
    user = await findUserById(linkedAccount.userId);
  }

  // 2) Link by verified email (never auto-link unverified)
  if (!user && profile.email) {
    const existing = await findUserByEmail(profile.email);
    if (existing) {
      if (!profile.emailVerified) {
        throw new ConflictError("An account with this email exists, but the provider email is not verified");
      }
      await createAccount({
        userId: existing.id,
        provider,
        providerAccountId: profile.providerAccountId,
      });
      user = existing;
    }
  }

  // 3) Create a fresh account
  if (!user) {
    if (!profile.email) throw new BadRequestError("Provider did not return an email");
    user = await createUser({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });
    await createAccount({
      userId: user.id,
      provider,
      providerAccountId: profile.providerAccountId,
    });

    await enqueueWelcomeEmail({
      userId: user.id,
      email: user.email,
      name: user.name ?? undefined,
      context,
    }).catch(() => {});

    await notify.welcome(user.id, user.name ?? undefined).catch(() => {});
  }

  if (user.disabledAt) {
    await revokeAllUserTokens(user.id);
    throw new ForbiddenError("This account has been disabled");
  }

  const tokens = await issueTokenPair(user);

  return {
    user: publicUser(user),
    tokens,
    redirect,
  };
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const normalizedEmail = input.email.toLowerCase().trim();
  const user = await findUserByEmail(normalizedEmail);

  if (user && !user.disabledAt) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await createVerificationCode({
      userId: user.id,
      email: normalizedEmail,
      code,
      type: "PASSWORD_RESET",
      expiresInMinutes: 15,
    });
    await sendPasswordResetCode(normalizedEmail, code, user.name ?? undefined);
  }

  return {
    message: "If an account with that email exists, a password reset code has been sent.",
    expiresInSeconds: 900,
  };
}

export async function resetPassword(input: ResetPasswordInput) {
  const normalizedEmail = input.email.toLowerCase().trim();
  const user = await findUserByEmail(normalizedEmail);
  if (!user || user.disabledAt) {
    throw new BadRequestError("Invalid or expired password reset code");
  }

  const validCode = await findValidVerificationCode({
    email: normalizedEmail,
    code: input.code,
    type: "PASSWORD_RESET",
    userId: user.id,
  });

  if (!validCode) {
    throw new BadRequestError("Invalid or expired password reset code");
  }

  const newHash = await hashPassword(input.newPassword);
  await updateUserPassword(user.id, newHash);
  await deleteVerificationCode(validCode.id);

  // Invalidate existing sessions for security
  await revokeAllUserTokens(user.id);

  return {
    message: "Password reset successful. Please sign in with your new password.",
  };
}

