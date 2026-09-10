import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import type { UserRole } from "@attune/types";
import {
  createRefreshToken as createRefreshTokenRepo,
  findRefreshTokenByHash,
  revokeAllUserTokens,
  revokeRefreshToken,
} from "../repository/userRepository";

export const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
);

export const ACCESS_TTL_SEC = 900; // 15 minutes
export const REFRESH_TTL_MS = 30 * 86_400_000; // 30 days

export function hashPassword(password: string): Promise<string> {
  return argonHash(password);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argonVerify(hash, password);
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(): string {
  return randomBytes(48).toString("base64url");
}

export async function signAccessToken(user: { id: string; role: UserRole }): Promise<string> {
  return new SignJWT({ role: user.role, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload;
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomToken();
  await createRefreshTokenRepo({
    userId,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return token;
}

export async function issueTokenPair(user: { id: string; role: UserRole }) {
  const accessToken = await signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SEC };
}

export async function signOAuthState(payload: { p: string; r?: string }): Promise<string> {
  return new SignJWT({ typ: "oauth_state", ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(JWT_SECRET);
}

export async function verifyOAuthState(state: string) {
  const { payload } = await jwtVerify(state, JWT_SECRET);
  return payload;
}
