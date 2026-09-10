import { z } from "zod";
import { USER_ROLES } from "@attune/types";

// ── Auth Fields ─────────────────────────────────────────────────────────────

export const emailField = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "Email is too long");

export const passwordCreateField = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

export const passwordLoginField = z
  .string({ required_error: "Password is required" })
  .min(1, "Password is required")
  .max(128, "Password is too long");

// ── Auth Request Schemas ───────────────────────────────────────────────────

export const registerSchema = z.object({
  email: emailField,
  password: passwordCreateField,
  name: z.string().trim().min(1, "Name cannot be empty").max(100, "Name is too long").optional(),
});

export const loginSchema = z.object({
  email: emailField,
  password: passwordLoginField,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, "Refresh token too short").max(500, "Refresh token too long"),
});

export const oauthProviderParamSchema = z.object({
  provider: z.enum(["google", "github"]),
});

export const oauthStartQuerySchema = z.object({
  redirect: z.string().optional(),
});

export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1, "Code is required"),
  state: z.string().min(1, "State is required"),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  email: emailField,
  code: z.string().regex(/^\d{6}$/, "Reset code must be 6 digits"),
  newPassword: passwordCreateField,
});

// ── Auth Response Schemas ──────────────────────────────────────────────────

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  timezone: z.string(),
  role: z.enum(USER_ROLES),
  createdAt: z.union([z.date(), z.string()]),
});

export const authResponseSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export const okResponseSchema = z.object({
  ok: z.literal(true),
});

// ── Inferred Types ─────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type PublicUserDTO = z.infer<typeof publicUserSchema>;
export type AuthResponseDTO = z.infer<typeof authResponseSchema>;
