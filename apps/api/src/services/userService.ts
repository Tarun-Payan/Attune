import type {
  ChangePasswordInput,
  DeviceRegistrationInput,
  NotificationSettingsInput,
  PatchMeInput,
  PreferencesInput,
  RequestEmailChangeInput,
  VerifyEmailChangeInput,
} from "@attune/schemas";
import { notify } from "@attune/notifications";
import {
  findLinkedAccounts,
  findUserByEmail,
  findUserById,
  updateUser,
  updateUserEmail,
  updateUserPassword,
} from "../repository/userRepository";
import { getUserTopicPreferences, setUserTopicPreferences } from "../repository/topicRepository";
import {
  createVerificationCode,
  deleteVerificationCode,
  findValidVerificationCode,
} from "../repository/verificationRepository";
import {
  ensureNotificationPrefs,
  getNotificationPrefs,
  listInAppNotifications,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
  registerDevice as registerDeviceRepo,
  removeDevice as removeDeviceRepo,
  updateNotificationPrefs,
} from "../repository/notificationRepository";
import { findSavedItems } from "../repository/itemRepository";
import { hashPassword, verifyPassword } from "./jwtService";
import { sendEmailChangeAlert, sendEmailChangeCode } from "../lib/mailer";
import { publicUser } from "./authService";
import { BadRequestError, ConflictError, NotFoundError } from "../errors";

export async function getMyProfile(userId: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const preferences = await getUserTopicPreferences(userId);
  const linked = await findLinkedAccounts(userId);

  return {
    user: publicUser(user),
    preferences,
    linkedProviders: linked.map((l) => l.provider),
  };
}

export async function updateProfile(userId: string, input: PatchMeInput) {
  const updated = await updateUser(userId, input);
  if (!updated) {
    throw new NotFoundError("User not found");
  }
  return { user: publicUser(updated) };
}

export async function replacePreferences(userId: string, input: PreferencesInput) {
  const existing = await getUserTopicPreferences(userId);
  if (existing.length > 0) {
    throw new BadRequestError(
      "Topic preferences can only be set during registration. Your interests are now tuned automatically based on reading behavior.",
    );
  }

  try {
    const preferences = await setUserTopicPreferences(userId, input.topics);
    return { preferences };
  } catch (err) {
    throw new BadRequestError(err instanceof Error ? err.message : "Failed to update preferences");
  }
}

export async function getNotificationSettings(userId: string) {
  const settings = await ensureNotificationPrefs(userId);
  return { settings };
}

export async function updateNotificationSettings(userId: string, input: NotificationSettingsInput) {
  const updated = await updateNotificationPrefs(userId, input);
  return { settings: updated };
}

export async function getInAppNotifications(userId: string, limit = 20, offset = 0) {
  return listInAppNotifications(userId, limit, offset);
}

export async function markInAppNotificationAsRead(userId: string, id: string) {
  const ok = await markInAppNotificationRead(userId, id);
  if (!ok) {
    throw new NotFoundError("Notification not found");
  }
  return { read: true as const };
}

export async function markAllInAppNotificationsAsRead(userId: string) {
  const count = await markAllInAppNotificationsRead(userId);
  return { markedReadCount: count };
}

export async function registerDevice(userId: string, input: DeviceRegistrationInput) {
  const device = await registerDeviceRepo({
    userId,
    token: input.token,
    platform: input.platform,
    provider: input.provider,
  });

  return {
    deviceId: device.id,
    registered: true as const,
  };
}

export async function removeDevice(userId: string, deviceId: string) {
  const removed = await removeDeviceRepo(userId, deviceId);
  if (!removed) {
    throw new NotFoundError("Device not found");
  }
  return { removed: true as const };
}

export async function getSavedItems(userId: string) {
  const items = await findSavedItems(userId);
  return {
    count: items.length,
    items,
  };
}

export async function requestEmailChange(userId: string, input: RequestEmailChangeInput) {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const newEmail = input.newEmail.toLowerCase().trim();
  if (user.email.toLowerCase().trim() === newEmail) {
    throw new BadRequestError("New email address must be different from your current email");
  }

  const existing = await findUserByEmail(newEmail);
  if (existing) {
    throw new ConflictError("This email address is already registered by another account");
  }

  // Generate 6-digit numeric verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await createVerificationCode({
    userId,
    email: newEmail,
    code,
    type: "EMAIL_CHANGE",
    expiresInMinutes: 15,
  });

  await sendEmailChangeCode(newEmail, code, user.name ?? undefined);

  return {
    message: `Verification code sent to ${newEmail}`,
    expiresInSeconds: 900,
  };
}

export async function verifyEmailChange(userId: string, input: VerifyEmailChangeInput) {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const newEmail = input.newEmail.toLowerCase().trim();
  const validCode = await findValidVerificationCode({
    email: newEmail,
    code: input.code,
    type: "EMAIL_CHANGE",
    userId,
  });

  if (!validCode) {
    throw new BadRequestError("Invalid or expired verification code");
  }

  const conflict = await findUserByEmail(newEmail);
  if (conflict && conflict.id !== userId) {
    throw new ConflictError("This email address is already registered by another account");
  }

  const oldEmail = user.email;
  const updated = await updateUserEmail(userId, newEmail);
  if (!updated) {
    throw new NotFoundError("User not found");
  }

  await deleteVerificationCode(validCode.id);

  // Send security notice to old email informing of change
  await sendEmailChangeAlert(oldEmail, newEmail, user.name ?? undefined);

  // Send in-app security notification
  await notify.emailChanged(userId, newEmail).catch(() => {});

  return {
    user: publicUser(updated),
    message: "Email address changed successfully",
  };
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  if (user.passwordHash) {
    const valid = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!valid) {
      throw new BadRequestError("Current password is incorrect");
    }
  }

  const newPasswordHash = await hashPassword(input.newPassword);
  await updateUserPassword(userId, newPasswordHash);

  // Send in-app security notification
  await notify.passwordChanged(userId).catch(() => {});

  return {
    message: "Password changed successfully",
  };
}

