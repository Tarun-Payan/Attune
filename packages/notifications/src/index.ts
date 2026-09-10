import { templates } from "./templates";
import { sendInAppNotification, sendBulkInAppNotifications } from "./in-app";
import type { CampaignPayload, TechUpdatePayload } from "./types";

export * from "./types";
export * from "./templates";
export * from "./in-app";

/**
 * High-level notification dispatcher.
 * Simplifies notification sending across services, workers, and background jobs.
 */
export const notify = {
  /** Low-level in-app notification creation */
  inApp: sendInAppNotification,

  /** Bulk in-app notification insertion */
  inAppBulk: sendBulkInAppNotifications,

  /**
   * Dispatches a security notification when a user's password is changed.
   */
  passwordChanged: async (userId: string) => {
    const template = templates.securityPasswordChanged();
    return sendInAppNotification({
      userId,
      ...template,
    });
  },

  /**
   * Dispatches a security notification when a user's email address is updated.
   */
  emailChanged: async (userId: string, newEmail: string) => {
    const template = templates.securityEmailChanged(newEmail);
    return sendInAppNotification({
      userId,
      ...template,
    });
  },

  /**
   * Dispatches a welcome notification to a newly onboarded user.
   */
  welcome: async (userId: string, name?: string) => {
    const template = templates.welcome(name);
    return sendInAppNotification({
      userId,
      ...template,
    });
  },

  /**
   * Dispatches a new tech/story match notification to a user based on their followed topics.
   */
  techUpdate: async (userId: string, payload: TechUpdatePayload) => {
    const template = templates.techUpdate(payload.title, payload.topicName);
    return sendInAppNotification({
      userId,
      itemId: payload.itemId,
      data: payload.itemId ? { itemId: payload.itemId } : undefined,
      ...template,
    });
  },

  /**
   * Dispatches a broadcast or admin campaign notification to a user.
   */
  campaign: async (userId: string, payload: CampaignPayload) => {
    const template = templates.campaign(payload.title, payload.body);
    return sendInAppNotification({
      userId,
      itemId: payload.itemId,
      data: payload.data,
      ...template,
    });
  },
};
