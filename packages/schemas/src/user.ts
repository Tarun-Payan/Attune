import { z } from "zod";
import { USER_ROLES } from "@attune/types";
import { publicUserSchema } from "./auth";

// ── Profile & Preferences Request Schemas ──────────────────────────────────

export const patchMeSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(100, "Name is too long").nullable().optional(),
  avatarUrl: z.string().max(500, "Avatar URL/identifier is too long").nullable().optional(),
  timezone: z.string().min(1).max(60).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

export const requestEmailChangeSchema = z.object({
  newEmail: z.string().trim().email("Please enter a valid email address"),
});

export const verifyEmailChangeSchema = z.object({
  newEmail: z.string().trim().email("Please enter a valid email address"),
  code: z.string().regex(/^\d{6}$/, "Verification code must be 6 digits"),
});

export const presetAvatarSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
});

export const avatarsResponseSchema = z.object({
  avatars: z.array(presetAvatarSchema),
});

export const topicPreferenceItemSchema = z.object({
  key: z.string().min(1).max(60),
  notify: z.boolean().default(false),
});

export const preferencesSchema = z.object({
  topics: z
    .array(topicPreferenceItemSchema)
    .max(20, "You can follow at most 20 topics"),
});

export const userPatchSchema = z.object({
  disabled: z.boolean(),
});

export const adminUsersQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── User Response Schemas ──────────────────────────────────────────────────

export const userPreferenceSchema = z.object({
  key: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  notify: z.boolean(),
  weight: z.number(),
});

export const meResponseSchema = z.object({
  user: publicUserSchema,
  preferences: z.array(userPreferenceSchema),
  linkedProviders: z.array(z.string()),
});

export const userRowSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: z.enum(USER_ROLES),
  timezone: z.string(),
  disabledAt: z.string().nullable(),
  createdAt: z.string(),
  topicCount: z.number(),
  deviceCount: z.number(),
  lastActive: z.string().nullable(),
  adminRoleId: z.string().nullable().optional(),
  adminRoleName: z.string().nullable().optional(),
});

export const adminUsersListResponseSchema = z.object({
  count: z.number(),
  users: z.array(userRowSchema),
});

// ── Inferred Types ─────────────────────────────────────────────────────────

export type PatchMeInput = z.infer<typeof patchMeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>;
export type VerifyEmailChangeInput = z.infer<typeof verifyEmailChangeSchema>;
export type AvatarsResponseDTO = z.infer<typeof avatarsResponseSchema>;
export type TopicPreferenceItemInput = z.infer<typeof topicPreferenceItemSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type UserPatchInput = z.infer<typeof userPatchSchema>;
export type AdminUsersQueryInput = z.infer<typeof adminUsersQuerySchema>;
export type MeResponseDTO = z.infer<typeof meResponseSchema>;
export type UserRowDTO = z.infer<typeof userRowSchema>;
export type AdminUsersListResponseDTO = z.infer<typeof adminUsersListResponseSchema>;

