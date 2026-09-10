import type { DevicePlatform, DeviceProvider, UserRole } from "./enums";

export interface User {
  id: string;
  email: string;
  passwordHash?: string | null;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
  role: UserRole;
  disabledAt?: Date | string | null;
  totalDwellMs?: number;
  createdAt: Date | string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
  role: UserRole;
  totalDwellMs?: number;
  createdAt: Date | string;
}

export interface TopicPreferenceItem {
  key: string;
  notify: boolean;
}

export interface UserPreference {
  key: string;
  name: string;
  icon: string | null;
  notify: boolean;
  weight: number;
}

export interface MeResponse {
  user: PublicUser;
  preferences: UserPreference[];
  linkedProviders: string[];
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  adminRoleId?: string | null;
  adminRoleName?: string | null;
  timezone: string;
  disabledAt: string | null;
  createdAt: string;
  topicCount: number;
  deviceCount: number;
  lastActive: string | null;
}

export interface Device {
  id: string;
  userId: string;
  fcmToken: string;
  provider: DeviceProvider;
  platform: DevicePlatform;
  lastActiveAt: Date | string;
}

export interface AdminUsersResponse {
  count: number;
  users: UserRow[];
}

