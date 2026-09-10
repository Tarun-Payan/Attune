import type { OAuthProvider, UserRole } from "./enums";
import type { PublicUser } from "./user";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse extends TokenPair {
  user: PublicUser;
}

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  name?: string | null;
  typ: "access" | "refresh" | "oauth_state";
  p?: string;
  r?: string;
}

export interface OAuthProfile {
  providerAccountId: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
}

export interface OAuthLoginParams {
  provider: OAuthProvider;
  providerAccountId: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
  redirect?: string;
}
