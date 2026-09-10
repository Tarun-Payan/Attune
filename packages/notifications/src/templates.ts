import type { NotificationKind } from "@attune/types";

export interface TemplateResult {
  title: string;
  body: string;
  kind: NotificationKind;
}

export const templates = {
  securityPasswordChanged(): TemplateResult {
    return {
      title: "Security Alert: Password Changed",
      body: "Your password was recently changed. If this wasn't you, reset your password immediately.",
      kind: "security",
    };
  },

  securityEmailChanged(newEmail: string): TemplateResult {
    return {
      title: "Security Alert: Email Updated",
      body: `Your account email was successfully updated to ${newEmail}. If this wasn't you, contact support immediately.`,
      kind: "security",
    };
  },

  welcome(name?: string): TemplateResult {
    return {
      title: name ? `Welcome to Attune, ${name}!` : "Welcome to Attune!",
      body: "Explore high-signal tech updates, tailor your topics, and stay ahead with curated stories.",
      kind: "welcome",
    };
  },

  techUpdate(title: string, topicName?: string): TemplateResult {
    const formattedTitle = topicName ? `New in ${topicName}` : "New for you";
    const formattedBody = title.length > 120 ? `${title.slice(0, 117)}...` : title;
    return {
      title: formattedTitle,
      body: formattedBody,
      kind: "topic_match",
    };
  },

  campaign(title: string, body: string): TemplateResult {
    return {
      title,
      body,
      kind: "campaign",
    };
  },
};
